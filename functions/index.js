/* eslint-disable max-len */
// functions/index.js
const {onValueWritten, onValueCreated} = require("firebase-functions/v2/database");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Import the daily nudge email service
const {DailyNudgeEmailService} = require("./email/daily-nudge-email");

admin.initializeApp();

// Set global options for all v2 functions in this file
// Ensure this region is enabled for Cloud Functions (2nd gen) in your Google Cloud project.
setGlobalOptions({region: "us-central1"});

// Initialize the daily nudge service
const dailyNudgeService = new DailyNudgeEmailService();

// eslint-disable-next-line valid-jsdoc
/**
Normalize gender values to handle case sensitivity and format differences
 */
function normalizeGender(gender) {
  if (!gender) return "prefer_not_to_say";
  return gender.toLowerCase()
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-z_]/g, ""); // Remove any other special characters
}

// eslint-disable-next-line valid-jsdoc
/**
 * Normalize looking for gender array
 */
function normalizeLookingFor(lookingForArray) {
  if (!Array.isArray(lookingForArray)) return ["any"];
  return lookingForArray.map((g) => {
    if (!g) return "any";
    return g.toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z_]/g, "");
  });
}

/**
 * Sets custom claims when two users are fully matched.
 * This function triggers when the data at /matches/{matchID}/users is written or changed.
 */
exports.setMatchClaims = onValueWritten(
    {
      ref: "/matches/{matchID}/users", // Trigger on the parent "users" node
      instance: "woobiedinobear-default-rtdb", // Your RTDB instance name
    },
    async (event) => {
      const matchID = event.params.matchID;
      const usersDataAfter = event.data.after.val(); // Data of the entire "users" node after the write

      if (!event.data.after.exists() || !usersDataAfter) {
        logger.info(
            `Match ${matchID} users node deleted or empty. ` +
                "No claims to set or clear based on this event.",
        );
        return null;
      }

      const userUIDs = Object.keys(usersDataAfter);

      if (userUIDs.length === 2) {
        logger.info(`Two users detected for match ${matchID}:`, userUIDs.join(", "));
        const claimsPromises = userUIDs.map(async (uid) => {
          try {
            const userRecord = await admin.auth().getUser(uid);
            const existingClaims = userRecord.customClaims || {};
            let userMatchIDs = existingClaims.matchAccess || [];

            if (!Array.isArray(userMatchIDs)) {
              userMatchIDs = [];
            }
            if (!userMatchIDs.includes(matchID)) {
              userMatchIDs.push(matchID);
            }

            await admin.auth().setCustomUserClaims(uid, {
              ...existingClaims,
              matchAccess: userMatchIDs,
            });
            logger.info(
                `Successfully set claims for user ${uid} for match ${matchID}. ` +
                        "New claims:", {matchAccess: userMatchIDs},
            );
          } catch (error) {
            logger.error(`Error setting claims for user ${uid} in match ${matchID}:`, error);
          }
        });
        return Promise.all(claimsPromises);
      } else {
        logger.info(
            `Match ${matchID} users node does not have 2 users. ` +
                `Currently: ${userUIDs.length}`,
        );
      }
      return null;
    },
);

/**
 * Advanced Matchmaker Cloud Function.
 * Triggered when a new user is added to the /queue/{queuedUserUID} path.
 */
exports.advancedMatchmaker = onValueCreated(
    {
      ref: "/queue/{queuedUserUID}",
      instance: "woobiedinobear-default-rtdb", // Your RTDB instance name
    },
    async (event) => {
      const newQueuedUserUID = event.params.queuedUserUID;
      const newQueuedUserData = event.data.val();

      if (!newQueuedUserData) {
        logger.info(`New queue entry for ${newQueuedUserUID} is null (already processed or deleted). Exiting.`);
        return null;
      }
      logger.info(
          `User ${newQueuedUserUID} (${newQueuedUserData.woobieName || "Unknown Woobie"}) ` +
            "entered queue. Looking for matches. Preferences:",
          {
            gender: newQueuedUserData.gender,
            lookingForGender: newQueuedUserData.lookingForGender,
            interestsCount: (newQueuedUserData.interests || []).length,
            mode: newQueuedUserData.mode,
            potentialMatchID: newQueuedUserData.potentialMatchIDForUser,
          },
      );

      const queueRef = admin.database().ref("/queue");
      const allQueueSnapshot = await queueRef.get();
      const allQueueData = allQueueSnapshot.val();

      if (!allQueueData) {
        logger.info("Queue is empty (besides new user). Cannot match.");
        return null;
      }

      let foundPartnerUID = null;
      let partnerData = null;

      for (const potentialPartnerUID in allQueueData) {
        if (potentialPartnerUID === newQueuedUserUID) {
          continue; // Don"t match user with themselves
        }
        const currentPotentialPartnerData = allQueueData[potentialPartnerUID];
        if (!currentPotentialPartnerData) {
          logger.warn(`Null data for potential partner ${potentialPartnerUID} in queue, skipping.`);
          continue;
        }

        logger.info(`Evaluating match: ${newQueuedUserUID} vs ${potentialPartnerUID}`);

        // Normalize gender data to handle case sensitivity and format differences
        const newUserGender = normalizeGender(newQueuedUserData.gender);
        const partnerGender = normalizeGender(currentPotentialPartnerData.gender);
        const newUserLookingFor = normalizeLookingFor(newQueuedUserData.lookingForGender);
        const partnerLookingFor = normalizeLookingFor(currentPotentialPartnerData.lookingForGender);

        logger.info(`  - User ${newQueuedUserUID} (is ${newUserGender}, wants ${newUserLookingFor.join(", ")})`);
        logger.info(`  - User ${potentialPartnerUID} (is ${partnerGender}, wants ${partnerLookingFor.join(", ")})`);

        // Check if they"re compatible
        const newUserLikesPartnerGender =
          // eslint-disable-next-line no-trailing-spaces
          newUserLookingFor.includes("any") || 
          newUserLookingFor.includes(partnerGender);

        const partnerLikesNewUserGender =
          partnerLookingFor.includes("any") ||
          partnerLookingFor.includes(newUserGender);

        if (!newUserLikesPartnerGender || !partnerLikesNewUserGender) {
          logger.info(`Gender mismatch: ${newQueuedUserUID} (is ${newUserGender}, wants ${newUserLookingFor.join(",")}) vs ${potentialPartnerUID} (is ${partnerGender}, wants ${partnerLookingFor.join(",")})`);
          continue;
        }

        logger.info(`Gender match OK for ${newQueuedUserUID} and ${potentialPartnerUID}`);

        const newUserInterests = newQueuedUserData.interests || [];
        const partnerInterests = currentPotentialPartnerData.interests || [];
        const commonInterests = newUserInterests.filter(
            (interest) => partnerInterests.includes(interest),
        );

        // Require at least 1 common interest for matching
        if (commonInterests.length < 1) {
          logger.info(
              `Interest mismatch: ${newQueuedUserUID} ` +
                    `vs ${potentialPartnerUID}. Common: ${commonInterests.length}`,
          );
          continue;
        }
        logger.info(
            `Interest check PASSED for ${newQueuedUserUID} and ${potentialPartnerUID}. ` +
                `Common: ${commonInterests.length}`,
        );

        // TODO: Implement actual dealbreaker logic here.
        // Example: if (newUserDealbreakers.some(db => partnerTraits.includes(db))) continue;

        foundPartnerUID = potentialPartnerUID;
        partnerData = currentPotentialPartnerData;
        logger.info(`Match FOUND between ${newQueuedUserUID} and ${foundPartnerUID}!`);
        break; // Exit loop once a match is found
      }

      if (foundPartnerUID && partnerData) {
        // Use the potentialMatchID of the user who triggered the function (newQueuedUserData)
        // This ensures the user who just entered the queue has their waiting.html listen to this ID.
        // The other user"s waiting.html will be updated via their /users/{uid}/currentMatch node.
        const finalMatchID = newQueuedUserData.potentialMatchIDForUser;

        if (!finalMatchID) {
          logger.error("Critical error: newQueuedUserData.potentialMatchIDForUser is missing. Cannot create match.", newQueuedUserData);
          return null;
        }
        logger.info(`Using finalMatchID: ${finalMatchID} from new user ${newQueuedUserUID}`);

        const matchUsersData = {
          [newQueuedUserUID]: newQueuedUserData.woobieName || "Woobie",
          [foundPartnerUID]: partnerData.woobieName || "Woobie Partner",
        };
        const matchModesData = {
          [newQueuedUserUID]: {mode: newQueuedUserData.mode || "normal"},
          [foundPartnerUID]: {mode: partnerData.mode || "normal"},
        };

        // Copy profile data to match-specific location for reveal-bios.html
        const newUserProfileData = {
          interests: newQueuedUserData.interests || [],
          dealbreakers: newQueuedUserData.dealbreakers || [],
          gender: newQueuedUserData.gender || "prefer_not_to_say",
          lookingForGender: newQueuedUserData.lookingForGender || ["any"],
          woobieName: newQueuedUserData.woobieName || "Woobie",
        };

        const partnerProfileData = {
          interests: partnerData.interests || [],
          dealbreakers: partnerData.dealbreakers || [],
          gender: partnerData.gender || "prefer_not_to_say",
          lookingForGender: partnerData.lookingForGender || ["any"],
          woobieName: partnerData.woobieName || "Woobie Partner",
        };

        // Use batch update for atomicity
        const matchUpdates = {};
        matchUpdates[`matches/${finalMatchID}/users`] = matchUsersData;
        matchUpdates[`matches/${finalMatchID}/modes`] = matchModesData;
        matchUpdates[`matches/${finalMatchID}/profiles/${newQueuedUserUID}`] = newUserProfileData;
        matchUpdates[`matches/${finalMatchID}/profiles/${foundPartnerUID}`] = partnerProfileData;
        matchUpdates[`matches/${finalMatchID}/createdAt`] = admin.database.ServerValue.TIMESTAMP;

        await admin.database().ref().update(matchUpdates);
        logger.info(`Match object created for ${finalMatchID} with profile data`);

        const uidsToSetClaims = [newQueuedUserUID, foundPartnerUID];
        const claimsPromises = uidsToSetClaims.map(async (uid) => {
          try {
            const userRecord = await admin.auth().getUser(uid);
            const existingClaims = userRecord.customClaims || {};
            let userMatchIDs = existingClaims.matchAccess || [];
            if (!Array.isArray(userMatchIDs)) userMatchIDs = [];
            if (!userMatchIDs.includes(finalMatchID)) {
              userMatchIDs.push(finalMatchID);
            }
            return admin.auth().setCustomUserClaims(uid, {
              ...existingClaims,
              matchAccess: userMatchIDs,
            });
          } catch (claimError) {
            logger.error(`Error setting claims for user ${uid} for match ${finalMatchID}:`, claimError);
            return null;
          }
        });
        await Promise.all(claimsPromises);
        logger.info(`Custom claims set for users in match ${finalMatchID}`);

        // Set the stage for the next step AFTER matching and queueing.
        // According to our revised flow, this should be "bio".
        const nextStageAfterMatch = "bio";
        try {
          await admin.database().ref(`/users/${newQueuedUserUID}/currentMatch`).update({
            matchID: finalMatchID,
            stage: nextStageAfterMatch,
            username: newQueuedUserData.woobieName, // Ensure WoobieName is in their currentMatch
          });
          await admin.database().ref(`/users/${foundPartnerUID}/currentMatch`).update({
            matchID: finalMatchID,
            stage: nextStageAfterMatch,
            username: partnerData.woobieName, // Ensure WoobieName is in their currentMatch
          });
          logger.info(`User profiles updated for match ${finalMatchID} to stage "${nextStageAfterMatch}"`);
        } catch (profileUpdateError) {
          logger.error("Error updating user profiles to next stage:", profileUpdateError);
        }

        try {
          await admin.database().ref(`/queue/${newQueuedUserUID}`).remove();
          await admin.database().ref(`/queue/${foundPartnerUID}`).remove();
          logger.info(`Users ${newQueuedUserUID} and ${foundPartnerUID} removed from queue.`);
        } catch (queueRemoveError) {
          logger.error("Error removing users from queue:", queueRemoveError);
        }

        return logger.info(
            `Successfully matched ${newQueuedUserUID} with ${foundPartnerUID} ` +
                `in match ${finalMatchID}.`,
        );
      } else {
        return logger.info(
            `User ${newQueuedUserUID} remains in queue, no suitable match found yet.`,
        );
      }
    },
);

/**
 * Daily Nudge Email Functions
 * Send daily reminder emails to users who are stuck at various stages
 */

/**
 * Scheduled function to send daily nudge emails
 * Runs every day at 10 AM UTC
 */
exports.sendDailyNudgeEmails = onSchedule(
    {
      schedule: "0 10 * * *", // 10 AM UTC daily
      timeZone: "UTC",
    },
    async (event) => {
      const db = admin.database();

      try {
        logger.info("Starting daily nudge email check...");

        // Get all users with active matches
        const usersSnapshot = await db.ref("users").get();
        const users = usersSnapshot.val() || {};

        let emailsSent = 0;
        let usersChecked = 0;
        const results = {
          sent: [],
          skipped: [],
          errors: [],
        };

        // Process users in batches to avoid overwhelming the system
        const userEntries = Object.entries(users);
        const batchSize = 50; // Process 50 users at a time

        for (let i = 0; i < userEntries.length; i += batchSize) {
          const batch = userEntries.slice(i, i + batchSize);

          // Process batch in parallel
          const batchPromises = batch.map(async ([userUID, userData]) => {
            usersChecked++;

            // Skip users without email or active match
            if (!userData.email || !userData.currentMatch) {
              results.skipped.push({
                userUID,
                reason: "No email or active match",
              });
              return;
            }

            try {
              const result = await dailyNudgeService.checkAndSendDailyNudge(userUID);

              if (result.sent) {
                emailsSent++;
                results.sent.push({
                  userUID,
                  email: userData.email,
                  stage: result.stage,
                  description: result.description,
                });
                logger.info(`✅ Nudge sent to ${userData.email}: ${result.stage}`);
              } else {
                results.skipped.push({
                  userUID,
                  reason: result.reason,
                });
              }
            } catch (error) {
              logger.error(`❌ Error processing user ${userUID}:`, error);
              results.errors.push({
                userUID,
                error: error.message,
              });
            }
          });

          await Promise.all(batchPromises);

          // Small delay between batches to be gentle on the email service
          if (i + batchSize < userEntries.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // Log summary
        logger.info("📊 Daily nudge email summary:");
        logger.info(`   Users checked: ${usersChecked}`);
        logger.info(`   Emails sent: ${emailsSent}`);
        logger.info(`   Users skipped: ${results.skipped.length}`);
        logger.info(`   Errors: ${results.errors.length}`);

        // Store results for analytics
        const today = new Date().toISOString().split("T")[0];
        await db.ref(`emailAnalytics/dailyNudge/${today}`).set({
          timestamp: admin.database.ServerValue.TIMESTAMP,
          usersChecked,
          emailsSent,
          skipped: results.skipped.length,
          errors: results.errors.length,
          successRate: usersChecked > 0 ? emailsSent / usersChecked : 0,
          details: {
            sentBreakdown: getStageBreakdown(results.sent),
            skipReasons: getSkipReasons(results.skipped),
          },
        });

        return {
          success: true,
          emailsSent,
          usersChecked,
        };
      } catch (error) {
        logger.error("❌ Error in daily nudge email function:", error);
        throw error;
      }
    },
);

/**
 * Manual trigger for testing daily nudge emails
 */
exports.sendTestNudgeEmail = onCall(async (request) => {
  const {auth} = request;

  if (!auth) {
    throw new Error("User must be authenticated");
  }

  try {
    const userUID = auth.uid;
    const result = await dailyNudgeService.checkAndSendDailyNudge(userUID);

    return {
      success: true,
      result,
    };
  } catch (error) {
    logger.error("Error sending test nudge email:", error);
    throw new Error("Failed to send test email");
  }
});

/**
 * Function to check a specific user"s nudge status (for debugging)
 */
exports.checkUserNudgeStatus = onCall(async (request) => {
  const {auth} = request;

  if (!auth) {
    throw new Error("User must be authenticated");
  }

  try {
    const userUID = auth.uid;

    // Get user and match data for analysis
    const userRef = admin.database().ref(`users/${userUID}`);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.val();

    if (!userData || !userData.currentMatch) {
      return {
        hasMatch: false,
        reason: "No active match",
      };
    }

    const matchID = userData.currentMatch.matchID;
    const matchRef = admin.database().ref(`matches/${matchID}`);
    const matchSnapshot = await matchRef.get();
    const matchData = matchSnapshot.val();

    // Find what stage they"re stuck at
    const users = matchData.users || {};
    const partnerUID = Object.keys(users).find((uid) => uid !== userUID);

    const stuckStage = await dailyNudgeService.findHighestPriorityStuckStage(userUID, partnerUID, matchData);

    return {
      hasMatch: true,
      matchID,
      partnerName: users[partnerUID],
      stuckStage: stuckStage || {stage: "none", description: "No action needed"},
      lastDailyEmail: userData.lastDailyEmail,
      canSendToday: userData.lastDailyEmail !== new Date().toISOString().split("T")[0],
    };
  } catch (error) {
    logger.error("Error checking user nudge status:", error);
    throw new Error("Failed to check status");
  }
});

// Utility functions for analytics
// eslint-disable-next-line require-jsdoc
function getStageBreakdown(sentEmails) {
  const breakdown = {};
  sentEmails.forEach((email) => {
    breakdown[email.stage] = (breakdown[email.stage] || 0) + 1;
  });
  return breakdown;
}

// eslint-disable-next-line require-jsdoc
function getSkipReasons(skippedEmails) {
  const reasons = {};
  skippedEmails.forEach((skip) => {
    reasons[skip.reason] = (reasons[skip.reason] || 0) + 1;
  });
  return reasons;
}

// Make sure there"s a single newline character at the very end of this file.
