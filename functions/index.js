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
// Import email templates
const {
  getWelcomeEmail,
  getTierCompletionEmail,
  getQueueEnteredEmail,
  getQueueWaitingEmail,
  getWeeklyDigestEmail,
} = require("./email/email-templates");

const sgMail = require("@sendgrid/mail");

// Initialize SendGrid
// For v2 functions, use environment variables instead of functions.config()
const sendgridKey = process.env.SENDGRID_API_KEY;
const sendgridFrom = process.env.SENDGRID_FROM_EMAIL || "friends@woobie.fun";
if (sendgridKey) {
  sgMail.setApiKey(sendgridKey);
  logger.info("SendGrid initialized successfully");
} else {
  logger.warn("SendGrid API key not configured. Email notifications will be skipped.");
}

/**
 * Send email notification when users are matched
 * Triggers when stage changes to 'bio'
 */
exports.sendMatchNotification = onValueWritten(
    {
      ref: "/users/{userId}/currentMatch/stage",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const userId = event.params.userId;
      const newStage = event.data.after.val();
      const previousStage = event.data.before.val();

      // Only send email when transitioning to 'bio' (matched)
      if (newStage !== "bio" || previousStage === "bio") {
        return null;
      }

      if (!sendgridKey) {
        logger.warn("SendGrid not configured. Skipping email.");
        return null;
      }

      try {
      // Get user's email
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        if (!userEmail) {
          logger.warn(`❌ No email found for user ${userId}`);
          return null;
        }

        // Get match info
        const userSnapshot = await admin.database().ref(`/users/${userId}`).get();
        const userData = userSnapshot.val();
        const matchID = userData.currentMatch?.matchID;
        const woobieName = userData.currentMatch?.username;

        logger.info(`📧 Preparing match notification for ${userId}:`, {
          email: userEmail,
          woobieName: woobieName,
          matchID: matchID,
        });

        const msg = {
          to: userEmail,
          from: sendgridFrom,
          subject: "🎉 You've been matched on Woobie!",
          html: `
          <div style="font-family: 'Courier New', monospace; background-color: #000; color: #00ff00; padding: 2rem; border: 2px solid #00ff00;">
            <h1 style="color: #33ff33;">🎉 You found a Woobie friend!</h1>
            <p>Hi <strong style="color: #00ffff;">${woobieName}</strong>,</p>
            <p>Great news! You've been matched with someone who shares your interests.</p>
            <p>Click below to continue your journey together:</p>
            <a href="https://woobie.app/bio/index.html"
               style="display: inline-block; margin: 1rem 0; padding: 1rem 2rem; background-color: #00ff00; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Continue to Your Match
            </a>
            <p style="color: #888; font-size: 0.9em;">Match ID: ${matchID}</p>
          </div>
        `,
          text: `Hi ${woobieName}, You've been matched on Woobie! Visit https://woobie.app/bio/index.html to continue.`,
        };

        await sgMail.send(msg);
        logger.info(`✅ Match notification email sent to ${userEmail} for user ${userId}`);

        // Track email delivery in database
        await admin.database().ref(`/users/${userId}/emailsSent/matchNotification`).set({
          sentAt: admin.database.ServerValue.TIMESTAMP,
          to: userEmail,
          woobieName: woobieName,
          matchID: matchID,
        });

        return null;
      } catch (error) {
        logger.error(`❌ Error sending match notification email for user ${userId}:`, error);
        if (error.response && error.response.body) {
          logger.error("SendGrid error details:", JSON.stringify(error.response.body));
        }

        // Track failed email in database
        await admin.database().ref(`/users/${userId}/emailsSent/matchNotification`).set({
          failedAt: admin.database.ServerValue.TIMESTAMP,
          error: error.message || "Unknown error",
        });

        return null;
      }
    },
);

/**
 * Send email when match reaches chatroom
 */
exports.sendChatroomNotification = onValueWritten(
    {
      ref: "/users/{userId}/currentMatch/stage",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const userId = event.params.userId;
      const newStage = event.data.after.val();
      const previousStage = event.data.before.val();

      // Only send when entering chatroom for first time
      if (newStage !== "chatroom" || previousStage === "chatroom") {
        return null;
      }

      if (!sendgridKey) {
        logger.warn("SendGrid not configured. Skipping email.");
        return null;
      }

      try {
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        if (!userEmail) {
          return null;
        }

        const userSnapshot = await admin.database().ref(`/users/${userId}`).get();
        const userData = userSnapshot.val();
        const woobieName = userData.currentMatch?.username;

        const msg = {
          to: userEmail,
          from: sendgridFrom,
          subject: "💬 Your Woobie chatroom is ready!",
          html: `
          <div style="font-family: 'Courier New', monospace; background-color: #000; color: #00ff00; padding: 2rem; border: 2px solid #00ff00;">
            <h1 style="color: #33ff33;">💬 Welcome to your chatroom!</h1>
            <p>Hi <strong style="color: #00ffff;">${woobieName}</strong>,</p>
            <p>You and your match have successfully completed all tiers! 🎉</p>
            <p>Your private chatroom is now open. You can share messages, images, and get to know each other better.</p>
            <a href="https://yourdomain.com/chat/index.html" 
               style="display: inline-block; margin: 1rem 0; padding: 1rem 2rem; background-color: #00ff00; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Enter Your Chatroom
            </a>
          </div>
        `,
          text: `Hi ${woobieName}, Your Woobie chatroom is ready! Visit https://yourdomain.com/chat/index.html`,
        };

        await sgMail.send(msg);
        logger.info(`Chatroom notification email sent to ${userEmail}`);
        return null;
      } catch (error) {
        logger.error(`Error sending chatroom notification:`, error);
        return null;
      }
    },
);
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

/**
 * Diagnostic function to check email delivery status for a user
 * This helps debug email issues
 */
exports.checkEmailStatus = onCall(async (request) => {
  const {auth} = request;

  if (!auth) {
    throw new Error("User must be authenticated");
  }

  try {
    const userUID = auth.uid;

    // Get user data
    const userRef = admin.database().ref(`users/${userUID}`);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.val();

    // Get auth data for email address
    const userRecord = await admin.auth().getUser(userUID);
    const userEmail = userRecord.email;

    // Collect email status
    const emailStatus = {
      uid: userUID,
      email: userEmail,
      emailVerified: userRecord.emailVerified,
      welcomeEmail: {
        sent: userData.welcomeEmailSent || false,
        sentAt: userData.welcomeEmailSentAt || null,
        messageId: userData.welcomeEmailMessageId || null,
        failed: userData.welcomeEmailFailed || false,
        error: userData.welcomeEmailError || null,
      },
      queueEmail: {
        sent: userData.queueEmailSent || false,
        sentAt: userData.queueEmailSentAt || null,
        messageId: userData.queueEmailMessageId || null,
      },
      matchNotification: userData.emailsSent?.matchNotification || null,
      lastDailyEmail: userData.lastDailyEmail || null,
    };

    logger.info(`Email status check for ${userUID}:`, emailStatus);

    return {
      success: true,
      ...emailStatus,
    };
  } catch (error) {
    logger.error("Error checking email status:", error);
    throw new Error("Failed to check email status: " + error.message);
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

/**
 * ========================================
 * NEW EMAIL NOTIFICATION FUNCTIONS
 * ========================================
 */

/**
 * Helper function to safely send emails with delivery tracking
 * Returns {sent: boolean, messageId: string, error: any}
 */
async function safeSendEmail(msg, logContext) {
  if (!sendgridKey) {
    logger.info(`Email skipped (no API key): ${logContext}`);
    return {sent: false, error: "No API key"};
  }
  try {
    const response = await sgMail.send(msg);
    const messageId = response && response[0] ? response[0].headers["x-message-id"] : null;
    logger.info(`✅ Email sent successfully: ${logContext}`, {
      to: msg.to,
      messageId: messageId,
      subject: msg.subject,
    });
    return {sent: true, messageId: messageId};
  } catch (error) {
    // Log the full error details from SendGrid
    logger.error(`❌ Error sending email (${logContext}):`, error);
    if (error.response && error.response.body) {
      logger.error("SendGrid error details:", JSON.stringify(error.response.body));
    }
    return {sent: false, error: error.message || error};
  }
}

/**
 * Send welcome email when a new user node is created in the database
 */
exports.sendWelcomeEmail = onValueCreated(
    {
      ref: "/users/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const userId = event.params.userId;
      const userData = event.data.val();

      // Skip if welcome email already sent
      if (userData.welcomeEmailSent) {
        return null;
      }

      try {
        // Get user's email from Auth
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        if (!userEmail) {
          logger.warn(`❌ No email for user ${userId}`);
          return null;
        }

        const displayName = userData.currentMatch?.username || userData.woobieName || "friend";
        logger.info(`📧 Preparing welcome email for ${userId}:`, {
          email: userEmail,
          displayName: displayName,
        });

        const emailContent = getWelcomeEmail(displayName);

        const msg = {
          to: userEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        const result = await safeSendEmail(msg, `welcome email to ${userEmail}`);

        // Store that we sent the welcome email
        if (result.sent) {
          await admin.database().ref(`users/${userId}`).update({
            welcomeEmailSent: true,
            welcomeEmailSentAt: admin.database.ServerValue.TIMESTAMP,
            welcomeEmailMessageId: result.messageId || null,
          });
        } else {
          await admin.database().ref(`users/${userId}`).update({
            welcomeEmailFailed: true,
            welcomeEmailFailedAt: admin.database.ServerValue.TIMESTAMP,
            welcomeEmailError: result.error || "Unknown error",
          });
        }

        return null;
      } catch (error) {
        logger.error(`❌ Error in welcome email function for ${userId}:`, error);
        return null;
      }
    },
);

/**
 * Send email when user enters the matchmaking queue
 */
exports.sendQueueEnteredEmail = onValueCreated(
    {
      ref: "/queue/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const userId = event.params.userId;
      const queueData = event.data.val();

      if (!queueData) {
        return null;
      }

      try {
        // Get user's email from Auth
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        if (!userEmail) {
          logger.warn(`❌ No email found for queued user ${userId}`);
          return null;
        }

        const userName = queueData.woobieName || "friend";
        logger.info(`📧 Preparing queue entered email for ${userId}:`, {
          email: userEmail,
          woobieName: userName,
        });

        const emailContent = getQueueEnteredEmail(userName);

        const msg = {
          to: userEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        const result = await safeSendEmail(msg, `queue entered email to ${userEmail}`);

        // Store when user entered queue for follow-up emails
        await admin.database().ref(`users/${userId}`).update({
          queueEnteredAt: admin.database.ServerValue.TIMESTAMP,
          queueEmailSent: result.sent,
          queueEmailSentAt: admin.database.ServerValue.TIMESTAMP,
          queueEmailMessageId: result.messageId || null,
        });

        return null;
      } catch (error) {
        logger.error(`❌ Error sending queue email for user ${userId}:`, error);
        return null;
      }
    },
);

/**
 * Check for users waiting in queue and send reminder emails
 * Runs daily at 2 PM UTC
 */
exports.sendQueueWaitingEmails = onSchedule(
    {
      schedule: "0 14 * * *", // 2 PM UTC daily
      timeZone: "UTC",
    },
    async (event) => {
      const db = admin.database();

      try {
        logger.info("Starting queue waiting email check...");

        const queueSnapshot = await db.ref("queue").get();
        const queueData = queueSnapshot.val() || {};

        let emailsSent = 0;

        for (const [userId, userData] of Object.entries(queueData)) {
          try {
            // Get when user entered queue
            const userSnapshot = await db.ref(`users/${userId}`).get();
            const userRecord = userSnapshot.val();

            if (!userRecord || !userRecord.queueEnteredAt) {
              continue;
            }

            const hoursWaiting = (Date.now() - userRecord.queueEnteredAt) / (1000 * 60 * 60);

            // Send emails at 24h, 48h, 72h intervals
            const shouldSend =
              (hoursWaiting >= 24 && hoursWaiting < 25 && !userRecord.queueEmail24h) ||
              (hoursWaiting >= 48 && hoursWaiting < 49 && !userRecord.queueEmail48h) ||
              (hoursWaiting >= 72 && hoursWaiting < 73 && !userRecord.queueEmail72h);

            if (!shouldSend) {
              continue;
            }

            const userAuth = await admin.auth().getUser(userId);
            const userEmail = userAuth.email;

            if (!userEmail) {
              continue;
            }

            const userName = userData.woobieName || "friend";
            const emailContent = getQueueWaitingEmail(userName, Math.floor(hoursWaiting));

            const msg = {
              to: userEmail,
              from: {
                email: sendgridFrom,
                name: "Woobie",
              },
              subject: emailContent.subject,
              html: emailContent.html,
            };

            await safeSendEmail(msg, `queue waiting email to ${userEmail} (${Math.floor(hoursWaiting)}h wait)`);
            logger.info(`Queue waiting email sent to ${userEmail} (${Math.floor(hoursWaiting)}h wait)`);

            // Mark which interval email was sent
            const updateKey = hoursWaiting >= 72 ? "queueEmail72h" :
                            hoursWaiting >= 48 ? "queueEmail48h" : "queueEmail24h";
            await db.ref(`users/${userId}`).update({
              [updateKey]: true,
            });

            emailsSent++;
          } catch (error) {
            logger.error(`Error processing queue waiting email for ${userId}:`, error);
          }
        }

        logger.info(`Queue waiting emails sent: ${emailsSent}`);
        return {success: true, emailsSent};
      } catch (error) {
        logger.error("Error in queue waiting email function:", error);
        throw error;
      }
    },
);

/**
 * Send email when partner completes Tier 1a
 */
exports.sendTier1aCompletionEmail = onValueCreated(
    {
      ref: "/matches/{matchID}/tier1aAnswers/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const matchID = event.params.matchID;
      const completedUserId = event.params.userId;

      try {
        // Get match data to find partner
        const matchSnapshot = await admin.database().ref(`matches/${matchID}`).get();
        const matchData = matchSnapshot.val();

        if (!matchData || !matchData.users) {
          return null;
        }

        // Find partner UID
        const partnerUID = Object.keys(matchData.users).find((uid) => uid !== completedUserId);
        if (!partnerUID) {
          return null;
        }

        // Get partner's email
        const partnerAuth = await admin.auth().getUser(partnerUID);
        const partnerEmail = partnerAuth.email;

        if (!partnerEmail) {
          return null;
        }

        const partnerName = matchData.users[partnerUID];
        const completedUserName = matchData.users[completedUserId];

        const emailContent = getTierCompletionEmail(partnerName, completedUserName, "tier1a");

        const msg = {
          to: partnerEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        await sgMail.send(msg);
        logger.info(`Tier 1a completion email sent to ${partnerEmail}`);

        return null;
      } catch (error) {
        logger.error(`Error sending Tier 1a completion email for match ${matchID}:`, error);
        return null;
      }
    },
);

/**
 * Send email when partner completes Tier 1b
 */
exports.sendTier1bCompletionEmail = onValueCreated(
    {
      ref: "/matches/{matchID}/tier1bAnswers/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const matchID = event.params.matchID;
      const completedUserId = event.params.userId;

      try {
        const matchSnapshot = await admin.database().ref(`matches/${matchID}`).get();
        const matchData = matchSnapshot.val();

        if (!matchData || !matchData.users) {
          return null;
        }

        const partnerUID = Object.keys(matchData.users).find((uid) => uid !== completedUserId);
        if (!partnerUID) {
          return null;
        }

        const partnerAuth = await admin.auth().getUser(partnerUID);
        const partnerEmail = partnerAuth.email;

        if (!partnerEmail) {
          return null;
        }

        const partnerName = matchData.users[partnerUID];
        const completedUserName = matchData.users[completedUserId];

        const emailContent = getTierCompletionEmail(partnerName, completedUserName, "tier1b");

        const msg = {
          to: partnerEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        await sgMail.send(msg);
        logger.info(`Tier 1b completion email sent to ${partnerEmail}`);

        return null;
      } catch (error) {
        logger.error(`Error sending Tier 1b completion email for match ${matchID}:`, error);
        return null;
      }
    },
);

/**
 * Send email when partner completes Tier 2
 */
exports.sendTier2CompletionEmail = onValueCreated(
    {
      ref: "/matches/{matchID}/tier2/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const matchID = event.params.matchID;
      const completedUserId = event.params.userId;

      try {
        const matchSnapshot = await admin.database().ref(`matches/${matchID}`).get();
        const matchData = matchSnapshot.val();

        if (!matchData || !matchData.users) {
          return null;
        }

        const partnerUID = Object.keys(matchData.users).find((uid) => uid !== completedUserId);
        if (!partnerUID) {
          return null;
        }

        const partnerAuth = await admin.auth().getUser(partnerUID);
        const partnerEmail = partnerAuth.email;

        if (!partnerEmail) {
          return null;
        }

        const partnerName = matchData.users[partnerUID];
        const completedUserName = matchData.users[completedUserId];

        const emailContent = getTierCompletionEmail(partnerName, completedUserName, "tier2");

        const msg = {
          to: partnerEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        await sgMail.send(msg);
        logger.info(`Tier 2 completion email sent to ${partnerEmail}`);

        return null;
      } catch (error) {
        logger.error(`Error sending Tier 2 completion email for match ${matchID}:`, error);
        return null;
      }
    },
);

/**
 * Send email when partner completes Tier 3
 */
exports.sendTier3CompletionEmail = onValueCreated(
    {
      ref: "/matches/{matchID}/tier3Answers/{userId}",
      instance: "woobiedinobear-default-rtdb",
    },
    async (event) => {
      const matchID = event.params.matchID;
      const completedUserId = event.params.userId;

      try {
        const matchSnapshot = await admin.database().ref(`matches/${matchID}`).get();
        const matchData = matchSnapshot.val();

        if (!matchData || !matchData.users) {
          return null;
        }

        const partnerUID = Object.keys(matchData.users).find((uid) => uid !== completedUserId);
        if (!partnerUID) {
          return null;
        }

        const partnerAuth = await admin.auth().getUser(partnerUID);
        const partnerEmail = partnerAuth.email;

        if (!partnerEmail) {
          return null;
        }

        const partnerName = matchData.users[partnerUID];
        const completedUserName = matchData.users[completedUserId];

        const emailContent = getTierCompletionEmail(partnerName, completedUserName, "tier3");

        const msg = {
          to: partnerEmail,
          from: {
            email: sendgridFrom,
            name: "Woobie",
          },
          subject: emailContent.subject,
          html: emailContent.html,
        };

        await sgMail.send(msg);
        logger.info(`Tier 3 completion email sent to ${partnerEmail}`);

        return null;
      } catch (error) {
        logger.error(`Error sending Tier 3 completion email for match ${matchID}:`, error);
        return null;
      }
    },
);

/**
 * Send weekly digest email to all active users
 * Runs every Sunday at 9 AM UTC
 */
exports.sendWeeklyDigest = onSchedule(
    {
      schedule: "0 9 * * 0", // Every Sunday at 9 AM UTC
      timeZone: "UTC",
    },
    async (event) => {
      const db = admin.database();

      try {
        logger.info("Starting weekly digest email send...");

        const usersSnapshot = await db.ref("users").get();
        const users = usersSnapshot.val() || {};

        let emailsSent = 0;
        const errors = [];

        for (const [userUID, userData] of Object.entries(users)) {
          try {
            // Skip users without email or active match
            if (!userData.email || !userData.currentMatch || !userData.currentMatch.matchID) {
              continue;
            }

            // Get match data
            const matchID = userData.currentMatch.matchID;
            const matchSnapshot = await db.ref(`matches/${matchID}`).get();
            const matchData = matchSnapshot.val();

            if (!matchData || !matchData.users) {
              continue;
            }

            // Find partner
            const partnerUID = Object.keys(matchData.users).find((uid) => uid !== userUID);
            const partnerName = matchData.users[partnerUID];

            // Calculate stats for the week
            const currentStage = userData.currentMatch.stage || "waiting";

            // Count tiers completed
            let tiersCompleted = 0;
            if (matchData.tier1aAnswers && matchData.tier1aAnswers[userUID]) tiersCompleted++;
            if (matchData.tier1bAnswers && matchData.tier1bAnswers[userUID]) tiersCompleted++;
            if (matchData.tier2 && matchData.tier2[userUID]) tiersCompleted++;
            if (matchData.tier3Answers && matchData.tier3Answers[userUID]) tiersCompleted++;

            // Count messages (if in chatroom)
            let messagesExchanged = 0;
            if (matchData.chat) {
              messagesExchanged = Object.values(matchData.chat).filter((msg) =>
                msg.senderUID === userUID || msg.senderUID === partnerUID,
              ).length;
            }

            // Determine next action
            let nextAction = null;
            let actionUrl = null;

            if (currentStage === "tier1a" && matchData.tier1aAnswers && matchData.tier1aAnswers[partnerUID] && !matchData.tier1aVotes[userUID]) {
              nextAction = "Vote on your partner's Tier 1a answers";
              actionUrl = "/tier1a/reveal-bios.html";
            } else if (currentStage === "tier1b" && matchData.tier1bAnswers && matchData.tier1bAnswers[partnerUID] && !matchData.tier1bVotes[userUID]) {
              nextAction = "Vote on your partner's Tier 1b answers";
              actionUrl = "/tier1b/index.html";
            } else if (currentStage === "tier2" && matchData.tier2 && matchData.tier2[partnerUID] && !matchData.tier2[userUID]) {
              nextAction = "Complete your Tier 2";
              actionUrl = "/tier2/index.html";
            } else if (currentStage === "tier3" && matchData.tier3Answers && matchData.tier3Answers[partnerUID] && !matchData.tier3Answers[userUID]) {
              nextAction = "Complete your Tier 3 answers";
              actionUrl = "/tier3/index.html";
            }

            const digestData = {
              partnerName,
              currentStage,
              messagesExchanged,
              tiersCompleted,
              nextAction,
              actionUrl,
            };

            const userName = userData.currentMatch.username || "friend";
            const emailContent = getWeeklyDigestEmail(userName, digestData);

            const msg = {
              to: userData.email,
              from: {
                email: sendgridFrom,
                name: "Woobie",
              },
              subject: emailContent.subject,
              html: emailContent.html,
            };

            await safeSendEmail(msg, `weekly digest to ${userData.email}`);
            emailsSent++;

            // Track that we sent the digest
            await db.ref(`users/${userUID}`).update({
              lastWeeklyDigest: new Date().toISOString().split("T")[0],
            });
          } catch (error) {
            logger.error(`Error sending weekly digest to user ${userUID}:`, error);
            errors.push({userUID, error: error.message});
          }
        }

        logger.info(`Weekly digest summary: ${emailsSent} sent, ${errors.length} errors`);

        return {
          success: true,
          emailsSent,
          errors: errors.length,
        };
      } catch (error) {
        logger.error("Error in weekly digest function:", error);
        throw error;
      }
    },
);

// Make sure there"s a single newline character at the very end of this file.
