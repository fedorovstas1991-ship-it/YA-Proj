const CRON_JOB_NAME = "opus-ui-phase1-watch";
const MONITOR_SESSION_LABEL = "opus-ui-phase1-active"; // Assuming this is the actual label from sessions_list
const FAILOVER_MODEL = "antigravity/gemini-3-pro";
const FAILOVER_LABEL = "opus-failover-gemini-pro";
const FAILOVER_TASK = "Resume task from opus-all-phases-full using Gemini Pro";
const STALL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

async function monitorOpusSession() {
  const currentTime = Date.now();
  const stalledThresholdTime = currentTime - STALL_THRESHOLD_MS;

  const sessions = await sessions_list();

  let targetSession = null;
  for (const session of sessions.sessions) {
    if (session.label === MONITOR_SESSION_LABEL) {
      targetSession = session;
      break;
    }
  }

  if (targetSession) {
    if (targetSession.updatedAt < stalledThresholdTime) {
      const failoverMessage = `ALERT: Session '${MONITOR_SESSION_LABEL}' (ID: ${targetSession.sessionId}) has stalled. Last update: ${new Date(targetSession.updatedAt).toLocaleString()}. Spawning failover agent '${FAILOVER_LABEL}'.`;

      console.log(failoverMessage);

      // Announce to Telegram (using message tool)
      await message({
        action: "send",
        to: "telegram",
        message: failoverMessage
      });

      // Spawn failover sub-agent
      await sessions_spawn({
        label: FAILOVER_LABEL,
        model: FAILOVER_MODEL,
        task: FAILOVER_TASK
      });

      console.log('Failover agent spawned successfully.');

    } else {
      console.log(`Session '${MONITOR_SESSION_LABEL}' is active. Last update: ${new Date(targetSession.updatedAt).toLocaleString()}. No action needed.`);
    }
  } else {
    console.log(`Session '${MONITOR_SESSION_LABEL}' not found. No action taken.`);
  }
}

monitorOpusSession();