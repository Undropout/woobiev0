/* eslint-disable max-len */
// functions/index.js
const {onValueWritten, onValueCreated} = require("firebase-functions/v2/database");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

// Set global options for all v2 functions in this file
// Ensure this region is enabled for Cloud Functions (2nd gen) in your Google Cloud project.
setGlobalOptions({region: "us-central1"});

/**
 * Sets custom claims when two users are fully matched.
 * This function triggers when the data at /matches/{matchID}/users is written or changed.
 */
exports.setMatchClaims = onValueWritten(
    {
      ref: "/matches/{matchID}/users", // Trigger on the parent 'users' node
      instance: "woobiedinobear-default-rtdb", // Your RTDB instance name
    },
    async (event) => {
      const matchID = event.params.matchID;
      const usersDataAfter = event.data.after.val(); // Data of the entire 'users' node after the write

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
          continue; // Don't match user with themselves
        }
        const currentPotentialPartnerData = allQueueData[potentialPartnerUID];
        if (!currentPotentialPartnerData) {
          logger.warn(`Null data for potential partner ${potentialPartnerUID} in queue, skipping.`);
          continue;
        }

        logger.info(`Evaluating match: ${newQueuedUserUID} vs ${potentialPartnerUID}`);
        logger.info(`  - User ${newQueuedUserUID} (is ${newQueuedUserData.gender}, wants ${newQueuedUserData.lookingForGender ? newQueuedUserData.lookingForGender.join(): "any"})`);
        logger.info(`  - User ${potentialPartnerUID} (is ${currentPotentialPartnerData.gender}, wants ${currentPotentialPartnerData.lookingForGender ? currentPotentialPartnerData.lookingForGender.join() : "any"})`);


        const newUserLookingFor = (newQueuedUserData.lookingForGender || ["any"]).map((g) => g.toLowerCase());
        const partnerLookingFor = (currentPotentialPartnerData.lookingForGender || ["any"]).map((g) => g.toLowerCase());
        const newUserGender = (newQueuedUserData.gender || "prefer_not_to_say").toLowerCase();
        const partnerGender = (currentPotentialPartnerData.gender || "prefer_not_to_say").toLowerCase();

        const newUserLikesPartnerGender =
                newUserLookingFor.includes("any") ||
                newUserLookingFor.includes(partnerGender);
        const partnerLikesNewUserGender =
                partnerLookingFor.includes("any") ||
                partnerLookingFor.includes(newUserGender);

        if (!newUserLikesPartnerGender || !partnerLikesNewUserGender) {
          logger.info(`Gender mismatch: ${newQueuedUserUID} vs ${potentialPartnerUID}. Failed check.`);
          continue;
        }
        logger.info(`Gender match OK for ${newQueuedUserUID} and ${potentialPartnerUID}`);

        const newUserInterests = newQueuedUserData.interests || [];
        const partnerInterests = currentPotentialPartnerData.interests || [];
        const commonInterests = newUserInterests.filter(
            (interest) => partnerInterests.includes(interest),
        );

        // Keeping the relaxed interest check for now.
        // Change '< 0' back to '< 1' once preferences are properly collected by client.
        if (commonInterests.length < 0) {
          logger.info(
              `Interest/dealbreaker mismatch (TEMPORARILY BYPASSED): ${newQueuedUserUID} ` +
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
        // The other user's waiting.html will be updated via their /users/{uid}/currentMatch node.
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

        await admin.database().ref(`/matches/${finalMatchID}/users`).set(matchUsersData);
        await admin.database().ref(`/matches/${finalMatchID}/modes`).set(matchModesData);
        await admin.database().ref(`/matches/${finalMatchID}/createdAt`).set(admin.database.ServerValue.TIMESTAMP);
        logger.info(`Match object created for ${finalMatchID}`);

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
        // According to our revised flow, this should be 'bio'.
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
          logger.info(`User profiles updated for match ${finalMatchID} to stage '${nextStageAfterMatch}'`);
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
// Make sure there's a single newline character at the very end of this file.
