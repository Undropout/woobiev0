/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
// Daily nudge email system for Woobie
// This checks for the highest priority action needed and sends one email per day

const sgMail = require("@sendgrid/mail");
const admin = require("firebase-admin");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class DailyNudgeEmailService {
  constructor() {
    this.fromEmail = "hello@woobie.app"; // Your verified domain
    this.fromName = "Woobie";
    this.baseUrl = "https://woobie.app"; // Your domain
  }

  // Main function to check and send daily nudge
  async checkAndSendDailyNudge(userUID) {
    try {
      // Get user data
      const userRef = admin.database().ref(`users/${userUID}`);
      const userSnapshot = await userRef.get();
      const userData = userSnapshot.val();

      if (!userData || !userData.email || !userData.currentMatch) {
        return {sent: false, reason: "No email or active match"};
      }

      const matchID = userData.currentMatch.matchID;
      const username = userData.username;

      // Check if we already sent an email today
      const today = new Date().toISOString().split("T")[0];
      const lastEmailDate = userData.lastDailyEmail;

      if (lastEmailDate === today) {
        return {sent: false, reason: "Already sent today"};
      }

      // Get match data
      const matchRef = admin.database().ref(`matches/${matchID}`);
      const matchSnapshot = await matchRef.get();
      const matchData = matchSnapshot.val();

      if (!matchData) {
        return {sent: false, reason: "Match not found"};
      }

      // Find partner
      const users = matchData.users || {};
      const partnerUID = Object.keys(users).find((uid) => uid !== userUID);
      const partnerName = users[partnerUID];

      if (!partnerUID || !partnerName) {
        return {sent: false, reason: "Partner not found"};
      }

      // Check what stage user is stuck at (highest priority first)
      const stuckStage = await this.findHighestPriorityStuckStage(userUID, partnerUID, matchData);

      if (!stuckStage) {
        return {sent: false, reason: "No action needed"};
      }

      // Send the appropriate email
      await this.sendNudgeEmail(userData.email, username, partnerName, stuckStage, matchID);

      // Record that we sent an email today
      await admin.database().ref(`users/${userUID}`).update({
        lastDailyEmail: today,
        lastNudgeStage: stuckStage.stage,
      });

      return {
        sent: true,
        stage: stuckStage.stage,
        description: stuckStage.description,
      };
    } catch (error) {
      console.error(`Error checking daily nudge for ${userUID}:`, error);
      return {sent: false, reason: "Error occurred"};
    }
  }

  async findHighestPriorityStuckStage(userUID, partnerUID, matchData) {
    // Check stages in priority order (1 = highest priority)

    // 1. Partner completed Tier 1a - time to read bio and vote
    if (this.isStuckAtTier1aVoting(userUID, partnerUID, matchData)) {
      return {
        stage: "tier1a_bio_vote",
        description: "Your partner shared their bio - time to read and vote!",
        action: "Read their bio and vote whether to continue",
        url: "/tier1a/reveal-bios.html",
      };
    }

    // 2. Partner completed Tier 1b - time to vote
    if (this.isStuckAtTier1bVoting(userUID, partnerUID, matchData)) {
      return {
        stage: "tier1b_vote",
        description: "Your partner completed their Tier 1b answers!",
        action: "Review their answers and vote to continue",
        url: "/tier1b/index.html",
      };
    }

    // 3. Partner sent Tier 1b message - time to send yours and vote
    if (this.isStuckAtTier1bMessage(userUID, partnerUID, matchData)) {
      return {
        stage: "tier1b_message",
        description: "Your partner sent you a message after Tier 1b",
        action: "Send your message and vote to continue to Tier 2",
        url: "/tier1b/index.html",
      };
    }

    // 4. Partner completed Tier 2 - time to vote
    if (this.isStuckAtTier2Voting(userUID, partnerUID, matchData)) {
      return {
        stage: "tier2_vote",
        description: "Your partner completed Tier 2 questions!",
        action: "Answer your Tier 2 questions",
        url: "/tier2/index.html",
      };
    }

    // 5. Partner sent Tier 2 reward - time to vote for Tier 3
    if (this.isStuckAtTier2RewardVoting(userUID, partnerUID, matchData)) {
      return {
        stage: "tier2_reward_vote",
        description: "Your partner shared something special with you!",
        action: "See what they shared and vote to continue",
        url: "/tier2/reveal.html",
      };
    }

    // 6. Partner completed Tier 3 - time to vote for chat
    if (this.isStuckAtTier3Voting(userUID, partnerUID, matchData)) {
      return {
        stage: "tier3_vote",
        description: "Your partner completed the final tier!",
        action: "Complete Tier 3 and vote to enter the chatroom",
        url: "/tier3/index.html",
      };
    }

    // 7. Chat message waiting (24h, 48h, 72h)
    const chatStuck = this.isStuckAtChatReply(userUID, partnerUID, matchData);
    if (chatStuck) {
      return {
        stage: "chat_reply",
        description: `Your partner sent you a message ${chatStuck.hoursAgo} hours ago`,
        action: "Continue your conversation in the chatroom",
        url: "/chat/index.html",
        hoursWaiting: chatStuck.hoursAgo,
      };
    }

    return null; // No action needed
  }

  // Stage checking functions
  isStuckAtTier1aVoting(userUID, partnerUID, matchData) {
    const tier1a = matchData.tier1a || {};
    const tier1aVotes = matchData.tier1aVotes || {};

    // Partner has completed tier1a, but user hasn"t voted
    return tier1a[partnerUID] && !tier1aVotes[userUID];
  }

  isStuckAtTier1bVoting(userUID, partnerUID, matchData) {
    const tier1b = matchData.tier1b || {};
    const tier1bVotes = matchData.tier1bVotes || {};

    // Partner has completed tier1b, but user hasn"t voted
    return tier1b[partnerUID] && !tier1bVotes[userUID];
  }

  isStuckAtTier1bMessage(userUID, partnerUID, matchData) {
    const tier1bLetters = matchData.tier1bLetters || {};
    const tier1bVotes = matchData.tier1bVotes || {};

    // Partner has sent message, but user hasn"t
    return tier1bLetters[partnerUID] && !tier1bLetters[userUID] && !tier1bVotes[userUID];
  }

  isStuckAtTier2Voting(userUID, partnerUID, matchData) {
    const tier2 = matchData.tier2 || {};

    // Partner has completed tier2, but user hasn"t
    return tier2[partnerUID] && !tier2[userUID];
  }

  isStuckAtTier2RewardVoting(userUID, partnerUID, matchData) {
    const tier2Rewards = matchData.tier2Rewards || {};
    const tier2Votes = matchData.tier2Votes || {};

    // Partner has sent reward, but user hasn"t voted
    return tier2Rewards[partnerUID] && !tier2Votes[userUID];
  }

  isStuckAtTier3Voting(userUID, partnerUID, matchData) {
    const tier3 = matchData.tier3 || {};
    const tier3Votes = matchData.tier3Votes || {};

    // Partner has completed tier3, but user hasn"t voted
    return tier3[partnerUID] && !tier3Votes[userUID];
  }

  isStuckAtChatReply(userUID, partnerUID, matchData) {
    const chat = matchData.chat || {};
    const messages = Object.values(chat).sort((a, b) => b.timestamp - a.timestamp);

    if (messages.length === 0) return false;

    const lastMessage = messages[0];

    // Last message was from partner
    if (lastMessage.senderUID !== partnerUID) return false;

    const hoursAgo = (Date.now() - lastMessage.timestamp) / (1000 * 60 * 60);

    // Check if it"s been 24h, 48h, or 72h since last message
    if (hoursAgo >= 24 && hoursAgo < 96) { // Cap at 96 hours (4 days)
      return {hoursAgo: Math.floor(hoursAgo)};
    }

    return false;
  }

  async sendNudgeEmail(userEmail, userName, partnerName, stuckStage, matchID) {
    const subject = this.getEmailSubject(stuckStage, partnerName);
    const html = this.getEmailHTML(userName, partnerName, stuckStage, matchID);

    const msg = {
      to: userEmail,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: subject,
      html: html,
      trackingSettings: {
        clickTracking: {enable: true},
        openTracking: {enable: true},
      },
    };

    const result = await sgMail.send(msg);
    console.log(`Daily nudge email sent to ${userEmail} for stage: ${stuckStage.stage}`);
    return result;
  }

  getEmailSubject(stuckStage, partnerName) {
    switch (stuckStage.stage) {
      case "tier1a_bio_vote":
        return `📖 ${partnerName} shared their bio with you`;
      case "tier1b_vote":
        return `💭 ${partnerName} completed their answers`;
      case "tier1b_message":
        return `💌 ${partnerName} sent you a message`;
      case "tier2_vote":
        return `🌊 ${partnerName} is ready for Tier 2`;
      case "tier2_reward_vote":
        return `🎁 ${partnerName} shared something special`;
      case "tier3_vote":
        return `✨ ${partnerName} completed the final tier`;
      case "chat_reply":
        // eslint-disable-next-line no-case-declarations
        const hours = stuckStage.hoursWaiting;
        if (hours < 48) {
          return `💭 ${partnerName} is waiting for your reply`;
        } else {
          return `💭 ${partnerName} sent you a message ${hours}h ago`;
        }
      default:
        return `💫 Your Woobie ${partnerName} is waiting`;
    }
  }

  getEmailHTML(userName, partnerName, stuckStage, matchID) {
    const actionUrl = `${this.baseUrl}${stuckStage.url}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: "Courier New", monospace; 
            background: #000; 
            color: #33ff33; 
            padding: 20px; 
            line-height: 1.6;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            border: 2px solid #33ff33; 
            padding: 20px;
            background: #111;
          }
          .highlight-box {
            background: #1a1a1a;
            border-left: 4px solid #ffb000;
            padding: 15px;
            margin: 15px 0;
            color: #ffcc99;
          }
          .button { 
            background: #000; 
            color: #33ff33; 
            border: 1px solid #33ff33; 
            padding: 12px 24px; 
            text-decoration: none; 
            display: inline-block;
            margin: 10px 0;
          }
          .ascii-art { 
            font-size: 12px; 
            white-space: pre; 
            color: #33ff33; 
            text-align: center;
            margin-bottom: 20px;
          }
          .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #33ff33; 
            font-size: 12px; 
            color: #99ff99;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="ascii-art">
__        __          _     _       
\\\\ \\\\      / /__   ___ | |__ (_) ___    
 \\\\ \\\\ /\\\\ / / _ \\\\ / _ \\\\| "__\\\\| |/ _ \\\\ 
  \\\\ V  V / (_) | (_) | |_) | |  __/  
   \\\\_/\\\\_/ \\\\___/ \\\\___/|_.__/|_|\\\\___| 
          </div>
          
          <h2>Hey ${userName}! 👋</h2>
          
          <div class="highlight-box">
            <strong>${stuckStage.description}</strong>
          </div>
          
          <p>${this.getStageSpecificMessage(stuckStage, partnerName)}</p>
          
          <a href="${actionUrl}" class="button">${stuckStage.action} →</a>
          
          <p><em>This is your daily Woobie update - we"ll only send one per day when there"s something waiting for you.</em></p>
          
          <div class="footer">
            <p>Questions? Reply to this email or visit our help center.<br>
            <a href="${this.baseUrl}/preferences" style="color: #00ffff;">Manage email preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getStageSpecificMessage(stuckStage, partnerName) {
    switch (stuckStage.stage) {
      case "tier1a_bio_vote":
        return `${partnerName} has shared their bio with you! This is your chance to learn more about them and decide if you"d like to continue to the next tier of questions.`;

      case "tier1b_vote":
        return `${partnerName} has completed their Tier 1b answers. You can now read their responses and decide whether to continue your friendship journey together.`;

      case "tier1b_message":
        return `${partnerName} sent you a personal message after Tier 1b. It"s time to send yours back and vote on whether to move to Tier 2!`;

      case "tier2_vote":
        return `${partnerName} has finished answering their Tier 2 questions. These go deeper into values and life experiences - perfect for building a stronger connection.`;

      case "tier2_reward_vote":
        return `${partnerName} has shared something special with you - it could be a message, image, or voice note. Check it out and decide if you"re ready for the final tier!`;

      case "tier3_vote":
        return `${partnerName} has completed all their Tier 3 answers! These are the deepest, most vulnerable questions. Complete yours and vote to enter the chatroom together.`;

      case "chat_reply":
        // eslint-disable-next-line no-case-declarations
        const hours = stuckStage.hoursWaiting;
        if (hours < 48) {
          return `${partnerName} sent you a message and is probably wondering if you saw it. Even a quick "hey, busy day but thinking of you!" can keep the connection alive.`;
        } else {
          return `It"s been ${hours} hours since ${partnerName} sent you a message. They might be wondering if you"re still interested in the friendship. A response would mean a lot!`;
        }

      default:
        return `${partnerName} is waiting for you to take the next step in your friendship journey. Check your Woobie dashboard to see what"s next!`;
    }
  }
}

module.exports = {DailyNudgeEmailService};
