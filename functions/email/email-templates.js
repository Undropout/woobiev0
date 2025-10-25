/* eslint-disable max-len */
/**
 * Email templates for Woobie notifications
 * All templates use the retro terminal aesthetic
 */

const baseUrl = "https://woobie.app";

/**
 * Woobie ASCII logo for emails
 */
const asciiLogo = `
╦ ╦╔═╗╔═╗╔╗ ╦╔═╗
║║║║ ║║ ║╠╩╗║║╣
╚╩╝╚═╝╚═╝╚═╝╩╚═╝
`;

/**
 * Welcome email for new signups
 */
function getWelcomeEmail(userName) {
  return {
    subject: "🎉 Welcome to Woobie - Your friendship journey begins!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: 'Courier New', monospace; background: #000; color: #33ff33; padding: 20px; margin: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 2px solid #33ff33; padding: 20px; background: #111;">
          <div style="font-size: 18px; white-space: pre; color: #33ff33; text-align: center; margin-bottom: 20px; font-weight: bold;">${asciiLogo}</div>

          <h2 style="color: #33ff33;">Welcome, ${userName}! 🌟</h2>

          <p style="color: #33ff33;">We're so excited you've joined Woobie - the place where meaningful friendships begin through authentic connection.</p>

          <div style="background: #1a1a1a; border-left: 4px solid #ffb000; padding: 15px; margin: 15px 0; color: #ffcc99;">
            <strong>🎯 How Woobie Works</strong>
          </div>

          <p style="color: #33ff33;"><strong>1. Pick Your Woobie Name</strong><br>
          Choose a fun, unique name that represents you.</p>

          <p style="color: #33ff33;"><strong>2. Set Your Preferences</strong><br>
          Tell us your interests and what you're looking for in a friend.</p>

          <p style="color: #33ff33;"><strong>3. Get Matched</strong><br>
          Our algorithm pairs you with someone who shares your interests.</p>

          <p style="color: #33ff33;"><strong>4. Progress Through Tiers</strong><br>
          Answer deeper questions at each tier to build trust and connection. After each tier, both of you vote whether to continue.</p>

          <p style="color: #33ff33;"><strong>5. Enter the Chatroom</strong><br>
          Once you complete all tiers together, unlock your private chatroom!</p>

          <div style="background: #0a2a0a; border: 1px solid #33ff33; padding: 10px; margin: 15px 0; font-size: 14px; color: #33ff33;">
            💡 <strong>Pro Tip:</strong> Be authentic! The best friendships form when both people are genuinely themselves.
          </div>

          <a href="${baseUrl}/name-picker/index.html" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">Continue Your Journey →</a>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #33ff33; font-size: 12px; color: #99ff99;">
            <p style="color: #99ff99;">Questions? Reply to this email anytime.<br>
            We're here to help! 💚</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

/**
 * Tier completion alerts - notify user when partner completes a tier
 */
function getTierCompletionEmail(userName, partnerName, tier) {
  const tierInfo = {
    "tier1a": {
      emoji: "📖",
      title: "Tier 1a Complete",
      description: `${partnerName} has completed their Tier 1a answers!`,
      details: "They've answered 6 personal questions about themselves. It's time to read their bio and answers, then vote on whether you'd like to continue to Tier 1b.",
      url: "/tier1a/reveal-bios.html",
      action: "Read Their Answers & Vote",
    },
    "tier1b": {
      emoji: "💭",
      title: "Tier 1b Complete",
      description: `${partnerName} has completed Tier 1b!`,
      details: "They've shared deeper thoughts and sent you a personal message. Review their answers and message, then vote on moving to Tier 2.",
      url: "/tier1b/index.html",
      action: "View Their Answers & Message",
    },
    "tier2": {
      emoji: "🌊",
      title: "Tier 2 Complete",
      description: `${partnerName} finished Tier 2!`,
      details: "They've shared something creative with you - maybe an image, voice note, or special message. This tier is all about creative expression!",
      url: "/tier2/reveal.html",
      action: "See What They Shared",
    },
    "tier3": {
      emoji: "✨",
      title: "Final Tier Complete!",
      description: `${partnerName} completed Tier 3 - the final tier!`,
      details: "These are the deepest, most vulnerable questions. If you both vote to continue after this, you'll unlock your private chatroom together!",
      url: "/tier3/index.html",
      action: "Complete Tier 3",
    },
  };

  const info = tierInfo[tier];

  return {
    subject: `${info.emoji} ${partnerName} completed ${info.title}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: 'Courier New', monospace; background: #000; color: #33ff33; padding: 20px; margin: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 2px solid #33ff33; padding: 20px; background: #111;">
          <div style="font-size: 18px; white-space: pre; color: #33ff33; text-align: center; margin-bottom: 20px; font-weight: bold;">${asciiLogo}</div>

          <h2 style="color: #33ff33;">Hey ${userName}! ${info.emoji}</h2>

          <div style="background: #1a1a1a; border-left: 4px solid #ffb000; padding: 15px; margin: 15px 0; color: #ffcc99;">
            <strong>${info.description}</strong>
          </div>

          <p style="color: #33ff33;">${info.details}</p>

          <div style="background: #0a2a0a; border: 1px solid #33ff33; padding: 10px; margin: 15px 0; font-size: 14px; color: #33ff33;">
            ⏰ <strong>Quick Response Tip:</strong> Responding within 24 hours keeps the momentum going and shows you're engaged!
          </div>

          <a href="${baseUrl}${info.url}" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">${info.action} →</a>

          <p style="margin-top: 20px; color: #33ff33;"><em>Remember: Both of you need to vote "continue" to move to the next tier. Take your time and be honest about your feelings!</em></p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #33ff33; font-size: 12px; color: #99ff99;">
            <p style="color: #99ff99;">Building a great friendship takes time and effort from both sides. Keep it up! 💚</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

/**
 * Queue entered notification
 */
function getQueueEnteredEmail(userName) {
  return {
    subject: "🔍 You're in the matchmaking queue!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: 'Courier New', monospace; background: #000; color: #33ff33; padding: 20px; margin: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 2px solid #33ff33; padding: 20px; background: #111;">
          <div style="font-size: 18px; white-space: pre; color: #33ff33; text-align: center; margin-bottom: 20px; font-weight: bold;">${asciiLogo}</div>

          <h2 style="color: #33ff33;">Great news, ${userName}! 🎯</h2>

          <div style="background: #1a1a1a; border-left: 4px solid #ffb000; padding: 15px; margin: 15px 0; color: #ffcc99;">
            <strong>You're now in the matchmaking queue!</strong>
          </div>

          <p style="color: #33ff33;">Our algorithm is searching for someone who:</p>
          <ul style="color: #33ff33;">
            <li>✓ Shares your interests</li>
            <li>✓ Matches your friendship preferences</li>
            <li>✓ Is looking for a meaningful connection</li>
          </ul>

          <div style="background: #0a2a0a; border: 1px solid #33ff33; padding: 10px; margin: 15px 0; font-size: 14px; color: #33ff33;">
            ⏳ <strong>What happens next?</strong><br>
            When we find your match, we'll send you an email right away. You'll then start your journey through the tiers together!
          </div>

          <p style="color: #33ff33;"><strong>Average wait time:</strong> Most users get matched within 24-48 hours, but it can vary based on your preferences and who's currently in the queue.</p>

          <p style="color: #ffcc99;"><em>Keep this page open or check back soon to see when you're matched!</em></p>

          <a href="${baseUrl}/interests-dealbreakers/waiting.html" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">Check Match Status →</a>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #33ff33; font-size: 12px; color: #99ff99;">
            <p style="color: #99ff99;">We'll notify you as soon as we find your perfect Woobie friend! 💚</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

/**
 * Still waiting in queue notification (sent after 24h, 48h, 72h)
 */
function getQueueWaitingEmail(userName, hoursWaiting) {
  const days = Math.floor(hoursWaiting / 24);
  const waitingMessage = days === 1 ?
    "You've been in the queue for about 24 hours" :
    `You've been in the queue for about ${days} days`;

  return {
    subject: "🔍 Still searching for your perfect match...",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: 'Courier New', monospace; background: #000; color: #33ff33; padding: 20px; margin: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 2px solid #33ff33; padding: 20px; background: #111;">
          <div style="font-size: 18px; white-space: pre; color: #33ff33; text-align: center; margin-bottom: 20px; font-weight: bold;">${asciiLogo}</div>

          <h2 style="color: #33ff33;">Hey ${userName} 👋</h2>

          <p style="color: #33ff33;">${waitingMessage}, and we're still searching for your perfect Woobie friend.</p>

          <div style="background: #1a1a1a; border-left: 4px solid #ffb000; padding: 15px; margin: 15px 0; color: #ffcc99;">
            <strong>Why the wait?</strong>
          </div>

          <p style="color: #33ff33;">Finding the right match takes time! We're looking for someone who:</p>
          <ul style="color: #33ff33;">
            <li>Genuinely shares your interests</li>
            <li>Matches your friendship preferences</li>
            <li>Is actively looking to make a meaningful connection</li>
          </ul>

          <div style="background: #0a2a0a; border: 1px solid #33ff33; padding: 10px; margin: 15px 0; font-size: 14px; color: #33ff33;">
            💡 <strong>Want to increase your chances?</strong><br>
            Consider updating your interests to include more options, or adjusting your gender preferences to "any" if that works for you.
          </div>

          <p style="color: #33ff33;"><strong>What's happening behind the scenes:</strong><br>
          Our algorithm checks every new person who enters the queue against your preferences. The moment we find a compatible match, you'll be paired instantly!</p>

          <a href="${baseUrl}/interests-dealbreakers/index.html" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">Update Your Preferences →</a>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #33ff33; font-size: 12px; color: #99ff99;">
            <p style="color: #99ff99;">Thanks for your patience! Good things take time. 💚<br>
            We promise we'll notify you the moment you're matched!</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

/**
 * Weekly digest email
 */
function getWeeklyDigestEmail(userName, digestData) {
  const {
    partnerName,
    currentStage,
    messagesExchanged,
    tiersCompleted,
    nextAction,
    actionUrl,
  } = digestData;

  // Format stage name for display
  const stageName = currentStage.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    subject: `📊 Your Woobie Weekly Summary with ${partnerName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: 'Courier New', monospace; background: #000; color: #33ff33; padding: 20px; margin: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 2px solid #33ff33; padding: 20px; background: #111;">
          <div style="font-size: 18px; white-space: pre; color: #33ff33; text-align: center; margin-bottom: 20px; font-weight: bold;">${asciiLogo}</div>

          <h2 style="color: #33ff33;">Your Weekly Woobie Summary 📊</h2>

          <p style="color: #33ff33;">Hey ${userName}! Here's what happened this week with ${partnerName}:</p>

          <div style="background: #1a1a1a; border-left: 4px solid #ffb000; padding: 15px; margin: 15px 0; color: #ffcc99;">
            <strong>🎯 Current Status: ${stageName}</strong>
          </div>

          <h3 style="color: #33ff33;">This Week's Progress</h3>
          <ul style="color: #33ff33;">
            <li>📝 Tiers completed together: <strong>${tiersCompleted}</strong></li>
            <li>💬 Messages exchanged: <strong>${messagesExchanged}</strong></li>
          </ul>

          ${nextAction ? `
          <div style="background: #0a2a0a; border: 1px solid #33ff33; padding: 10px; margin: 15px 0; font-size: 14px; color: #33ff33;">
            🔔 <strong>Next Step:</strong> ${nextAction}
          </div>
          <a href="${baseUrl}${actionUrl}" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">Take Action →</a>
          ` : `
          <div style="background: #2a1a00; border: 1px solid #ffb000; padding: 10px; margin: 15px 0; font-size: 14px; color: #ffcc99;">
            🎉 <strong>You're all caught up!</strong> Keep the conversation going in your chatroom.
          </div>
          <a href="${baseUrl}/chat/index.html" style="background: #000; color: #33ff33; border: 2px solid #33ff33; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold;">Open Chatroom →</a>
          `}

          <h3 style="color: #33ff33;">💭 Connection Tips</h3>
          <p style="color: #33ff33;">Great friendships need nurturing! Here are some ideas:</p>
          <ul style="color: #33ff33;">
            <li>Share something that made you think of them this week</li>
            <li>Ask about something they mentioned in a previous conversation</li>
            <li>Send a voice note or image to add variety to your chats</li>
          </ul>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #33ff33; font-size: 12px; color: #99ff99;">
            <p style="color: #99ff99;">Keep building that connection! 💚<br>
            <a href="${baseUrl}/preferences" style="color: #00ffff;">Manage email preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

module.exports = {
  getWelcomeEmail,
  getTierCompletionEmail,
  getQueueEnteredEmail,
  getQueueWaitingEmail,
  getWeeklyDigestEmail,
};
