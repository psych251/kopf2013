/*
 * Replication of Kopf et al. (2013, PLoS ONE 8(9): e75598): emotional word n-back task.
 *
 * Design summary
 *   IVs (both within-subjects): n-back load (1, 2, 3) x word valence (positive, negative, neutral).
 *   DVs: one row per word with task "nback": `responded`, `rt` (ms from word onset), `is_target`,
 *        `correct`, `outcome` (hit / miss / false_alarm / correct_rejection). Errors = misses +
 *        false alarms.
 *   Trials: practice = 3 neutral blocks (1-, 2-, 3-back), 30 words each, 6 targets each.
 *        Main = 27 blocks (3 per load x valence cell), 20 words each, 2 cue -> target pairs each.
 *        Each word 500 ms + 500 ms blank (1000 ms; a block lasts 20 s). Space bar accepted
 *        throughout the 1000 ms. Every block is preceded by a 20 s pause showing its instruction.
 *   Randomization: main block order shuffled so the n-back level always changes from one block
 *        to the next; valence order is otherwise random. Words are drawn at random from the
 *        valence's 10-word pool; cue positions are random; no word repeats any of the previous
 *        three words except at a target, so every block has exactly the intended targets.
 *   Checks: instruction check (multiple choice) repeats the instructions until answered correctly.
 *
 * Timeline
 *   1. consent  2. welcome  3. n-back instructions + instruction check
 *   4. practice (1-, 2-, 3-back)  5. main task (27 blocks)  6. feedback  7. debrief
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
window.TEMPLATE_VERSION = "0.1.0";

const EXPERIMENT = {
  // Firestore path: experiments/<id>/participants/... Change it when you start a new study
  // so pilot data and real data never mix (e.g. "smith2016-pilot-a", "smith2016-final").
  id: "framing-demo",

  // Trials per Firestore write. 1 = save every trial the moment it finishes (dropouts leave
  // partial data). The free tier allows 20,000 writes/day: with 200 participants x 100 trials
  // you would exceed it, so raise this for long trial-based tasks (e.g. 20).
  chunk_size: 20,

  // Also store the complete jsPsych dataset on the participant document at the end.
  // Costs one extra write and makes export robust; turn off if trials are very large.
  save_full_data_at_end: true,

  // Prolific: if set, participants are redirected to Prolific when they finish.
  // Leave empty for local testing or non-Prolific samples.
  prolific_completion_code: "",

  // Contact shown in consent and debrief.
  contact_email: "bsevchik@stanford.edu",

  // Does this study need a physical keyboard? This one does (the n-back task uses the space bar).
  // On a phone or tablet no keyboard appears, so a participant cannot answer those trials;
  // they would time out silently and the session would still look complete. When true, such
  // devices are turned away before consent. Set to false if your study is buttons/touch only.
  requires_keyboard: true,

  // DEBUGGING ONLY. Shows a "Skip section" button in the corner that ends the current section
  // (welcome, n-back instructions, practice, main task, feedback) and jumps to the next one.
  // Consent and debrief cannot be skipped. Skipped trials are saved with `debug_skipped: true`
  // and every row carries `debug_skip_buttons`, so debug runs are easy to drop.
  // MUST be false before real data collection.
  debug_skip_buttons: true,
};

// True on anything with a mouse, trackpad, or stylus, including laptops with touchscreens.
// False on phones and tablets without a pointing device, which are also the devices with no
// physical keyboard. See docs/student-guide.md "Devices".
function hasFinePointer() {
  return !!(window.matchMedia && window.matchMedia("(any-pointer: fine)").matches);
}

// `?emulator=1` in the URL sends data to the local emulator instead of the real project.
// Used by `npm test`; handy for development too (start it with `npm run emulators`).
const URL_PARAMS = new URLSearchParams(window.location.search);
const USE_EMULATOR = URL_PARAMS.get("emulator") === "1";
// `?chunk_size=N` overrides the setting above; used by the test suite to exercise chunked writes.
const CHUNK_SIZE = Number(URL_PARAMS.get("chunk_size")) || EXPERIMENT.chunk_size;
// Test-only: `?cc=CODE` sets a Prolific completion code during emulator runs, so the test
// suite can check the screen a participant sees once you have set yours. Ignored in live runs.
if (USE_EMULATOR && URL_PARAMS.get("cc")) EXPERIMENT.prolific_completion_code = URL_PARAMS.get("cc");

// n-back timing (ms), from Kopf et al. (2013): each word 500 ms, then a 500 ms blank, and a 20 s
// pause before every block. Test-only: `?fast=1` shrinks these so the robot can play the whole
// task in under a minute. It is honoured only on localhost, so it can never affect a live run.
const IS_LOCALHOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const FAST = IS_LOCALHOST && URL_PARAMS.get("fast") === "1";
const TIMING = FAST
  ? { word_ms: 20, soa_ms: 40, pause_ms: 50 }
  : { word_ms: 500, soa_ms: 1000, pause_ms: 20000 };

// ---------------------------------------------------------------------------
// Stimuli (copied from materials/nback-word-ratings.csv and
// materials/nback-practice-word-ratings.csv; materials/ itself is not published)
// ---------------------------------------------------------------------------
const WORDS = {
  positive: ["heaven", "beauty", "cuddle", "rabbit", "couple", "guitar", "riches", "sundae", "kitten", "giggle"],
  negative: ["coffin", "trauma", "malice", "damage", "orphan", "duress", "demise", "dismay", "poison", "maggot"],
  neutral: ["bonnet", "column", "packet", "saddle", "vessel", "ticket", "shovel", "funnel", "barrel", "thesis"],
};
const PRACTICE_WORDS = [
  "bucket", "mallet", "pallet", "docket", "kennel", "pellet", "cannon", "cocoon", "deacon", "beacon",
  "bottle", "button", "buckle", "fiddle", "middle", "paddle", "border", "corner", "barber", "tanker",
  "banker", "bunker", "kernel", "sermon", "tassel", "filter", "binder", "jumper", "sensor", "roster",
];

const NBACK = {
  levels: [1, 2, 3],
  valences: ["positive", "negative", "neutral"],
  blocks_per_cell: 3,
  words_per_block: 20,
  targets_per_block: 2,
  practice_words_per_block: 30,
  practice_targets_per_block: 6,
};

// ---------------------------------------------------------------------------
// Boot: connect the saver first so even a crash in the first trial gets logged.
// ---------------------------------------------------------------------------
(async function main() {
  const deviceSupported = !EXPERIMENT.requires_keyboard || hasFinePointer();

  const saver = await DataSaver.init({
    experiment_id: EXPERIMENT.id,
    chunk_size: CHUNK_SIZE,
    save_full_data_at_end: EXPERIMENT.save_full_data_at_end,
    use_emulator: USE_EMULATOR,
    contact_email: EXPERIMENT.contact_email,
  });
  window.__saver = saver; // for debugging and the automated test

  // Record the device verdict on the participant document before anything else, so a
  // participant turned away below is still visible in the data rather than simply absent.
  saver.updateParticipant({ device_supported: deviceSupported, requires_keyboard: EXPERIMENT.requires_keyboard });

  if (!deviceSupported) {
    document.body.innerHTML =
      '<div id="device-unsupported" class="jspsych-content" style="max-width:640px;margin:15vh auto;font:16px/1.6 system-ui,sans-serif;">' +
      "<h2>Please use a computer</h2>" +
      "<p>This study needs a computer with a physical keyboard, because part of it is answered " +
      "by pressing keys. Phones and tablets cannot be used.</p>" +
      "<p>Please reopen this link on a laptop or desktop computer. If you were sent here from " +
      "Prolific, you can return the study and take it later on a computer; nothing has been recorded " +
      "against you.</p>" +
      "<p>Questions: <a href=\"mailto:" + EXPERIMENT.contact_email + "\">" + EXPERIMENT.contact_email + "</a></p></div>";
    return;
  }

  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: true,
    on_data_update: (trial) => saver.onTrial(trial),
    on_finish: async () => {
      const el = jsPsych.getDisplayElement();
      el.innerHTML = '<div id="finish-message"><p class="thanks">Saving your responses…</p></div>';
      // finish() flushes remaining trials, marks the participant complete, and (only if
      // saving failed) appends a download-fallback box to the display element.
      const result = await saver.finish(jsPsych);
      const consentRow = jsPsych.data.get().filter({ task: "consent" }).values()[0];
      const consented = !consentRow || consentRow.consented !== false;
      const msg = document.getElementById("finish-message");

      if (!consented) {
        msg.innerHTML = "<h2 class='thanks'>Thank you</h2><p class='thanks'>You chose not to participate. " +
          "You may close this window" + (EXPERIMENT.prolific_completion_code ? " and return the study on Prolific" : "") + ".</p>";
        return;
      }
      if (result.ok && EXPERIMENT.prolific_completion_code && !USE_EMULATOR) {
        msg.innerHTML = "<p class='thanks'>Saved. Returning you to Prolific…</p>";
        window.location.href =
          "https://app.prolific.com/submissions/complete?cc=" + EXPERIMENT.prolific_completion_code;
        return;
      }
      // In emulator/test runs we stay on the page instead of navigating to Prolific, so that
      // setting a completion code can never turn `npm test` or CI red. Live runs redirect above.
      msg.innerHTML =
        "<h2 class='thanks'>All done</h2>" +
        (result.ok ? "<p class='thanks'>Your responses were saved. Thank you for participating!</p>" : "") +
        (EXPERIMENT.prolific_completion_code
          ? "<p class='thanks'>Your completion code is <strong>" + EXPERIMENT.prolific_completion_code + "</strong>.</p>"
          : "");
    },
  });

  // Record the participant id and URL parameters on every trial row.
  jsPsych.data.addProperties({
    // Must be the run-scoped document id, so trial rows join to participants.csv on export.
    participant_id: saver.docId,
    prolific_pid: saver.params.PROLIFIC_PID || null,
    experiment_id: EXPERIMENT.id,
  });

  // No between-subjects factor: every participant does every load x valence cell.
  jsPsych.data.addProperties({ design: "within-subjects", fast_timing: FAST });
  saver.updateParticipant({ design: "within-subjects", fast_timing: FAST });
  jsPsych.data.addProperties({ debug_skip_buttons: EXPERIMENT.debug_skip_buttons });
  saver.updateParticipant({ debug_skip_buttons: EXPERIMENT.debug_skip_buttons });

  // -------------------------------------------------------------------------
  // Debug "Skip section" button (EXPERIMENT.debug_skip_buttons). Each skippable section is a
  // named timeline (see `section` below); the button ends the current trial and aborts that
  // timeline, so jsPsych moves on to whatever comes after it.
  // -------------------------------------------------------------------------
  let currentSection = null;
  let skipButton = null;
  if (EXPERIMENT.debug_skip_buttons) {
    console.warn("EXPERIMENT.debug_skip_buttons is on. Turn it off before collecting real data.");
    skipButton = document.createElement("button");
    skipButton.id = "debug-skip";
    skipButton.className = "jspsych-btn";
    skipButton.hidden = true;
    // Never take keyboard focus: a focused button would be "clicked" by the n-back space bar.
    skipButton.tabIndex = -1;
    skipButton.addEventListener("mousedown", (e) => e.preventDefault());
    skipButton.addEventListener("click", () => {
      if (!currentSection) return;
      const name = currentSection;
      setSection(null);
      jsPsych.abortTimelineByName(name);
      jsPsych.pluginAPI.cancelAllKeyboardResponses();
      jsPsych.pluginAPI.clearAllTimeouts();
      jsPsych.finishTrial({ response: null, rt: null, debug_skipped: true });
    });
    document.body.appendChild(skipButton);
  }
  function setSection(name) {
    currentSection = name;
    if (!skipButton) return;
    skipButton.hidden = !name;
    if (name) skipButton.textContent = `Skip section: ${name} (debug)`;
  }
  // Wraps trials in a named timeline that the skip button can abort.
  const section = (name, timeline) => ({
    name,
    timeline,
    on_timeline_start: () => setSection(name),
    on_timeline_finish: () => setSection(null),
  });

  // -------------------------------------------------------------------------
  // 1. Consent (course-wide IRB text; edit only the contact address)
  // -------------------------------------------------------------------------
  const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="consent">
        <h2>Consent</h2>
        <p>By answering the following questions, you are participating in a study being performed by
        cognitive scientists in the Stanford Department of Psychology. If you have questions about
        this research, please contact us at <a href="mailto:${EXPERIMENT.contact_email}">${EXPERIMENT.contact_email}</a>.
        You must be at least 18 years old to participate. Your participation in this research is
        voluntary. You may decline to answer any or all of the following questions. You may decline
        further participation, at any time, without adverse consequences. Your anonymity is assured;
        the researchers who have requested your participation will not receive any personal
        information about you.</p>
      </div>`,
    choices: ["I agree to participate", "I do not agree"],
    data: { task: "consent" },
    on_finish: (data) => {
      data.consented = data.response === 0;
      if (!data.consented) {
        // No end message here: jsPsych would paint it over the screen that on_finish renders.
        jsPsych.abortExperiment();
      }
    },
  };

  // -------------------------------------------------------------------------
  // 2. Instructions
  // -------------------------------------------------------------------------
  const instructions = {
    type: jsPsychInstructions,
    pages: [
      `<h2>Welcome</h2>
       <p>This short study has two parts: one practice task
       and a longer memory task. It takes about thirty minutes.</p>`,
      `<p>Please complete the study in one sitting, in a quiet place, on a laptop or desktop
       computer. Use the buttons or the arrow keys to move between pages.</p>`,
    ],
    show_clickable_nav: true,
    data: { task: "instructions" },
  };

  // -------------------------------------------------------------------------
  // 3. n-back instructions and instruction check (repeats until answered correctly)
  // -------------------------------------------------------------------------
  const nbackInstructions = {
    type: jsPsychInstructions,
    pages: [
      `<h2>Memory task</h2>
       <p>In this task you will see words appear one at a time in the middle of the screen.
       Each word is shown only briefly, so keep your eyes on the screen.</p>
       <p>The words come in short blocks. Before each block, a screen tells you whether the
       block is <strong>1-back</strong>, <strong>2-back</strong>, or <strong>3-back</strong>.</p>`,
      `<h2>When to press the space bar</h2>
       <p>Press the <strong>space bar</strong> whenever the word on the screen is the same as the
       word you saw <em>n</em> words before it:</p>
       <ul>
         <li><strong>1-back:</strong> the word is the same as the word just before it.<br>
           <span style="font-family:monospace">TABLE &nbsp; CHAIR &nbsp; <u>CHAIR</u></span> &larr; press</li>
         <li><strong>2-back:</strong> the word is the same as the word two words before it.<br>
           <span style="font-family:monospace">TABLE &nbsp; CHAIR &nbsp; <u>TABLE</u></span> &larr; press</li>
         <li><strong>3-back:</strong> the word is the same as the word three words before it.<br>
           <span style="font-family:monospace">TABLE &nbsp; CHAIR &nbsp; LAMP &nbsp; <u>TABLE</u></span> &larr; press</li>
       </ul>
       <p>For every other word, do nothing. Respond as quickly and accurately as you can.</p>`,
      `<p>Between blocks there is a 20-second pause. You will start with three practice
       blocks (1-back, 2-back, then 3-back), followed by the main task.</p>
       <p>First, a quick question to check the instructions.</p>`,
    ],
    show_clickable_nav: true,
    data: { task: "instructions" },
  };
  let checkAttempt = 0;
  const instructionCheck = {
    type: jsPsychSurvey,
    survey_json: {
      showQuestionNumbers: "off",
      completeText: "Continue",
      pages: [
        {
          elements: [
            {
              type: "radiogroup", name: "two_back_rule", isRequired: true, choicesOrder: "random",
              title: "In a 2-back block, when should you press the space bar?",
              choices: [
                { value: "two_back", text: "When the word is the same as the word two words before it" },
                { value: "one_back", text: "When the word is the same as the word just before it" },
                { value: "every_second", text: "After every second word" },
                { value: "emotional", text: "Whenever the word is emotional" },
              ],
            },
          ],
        },
      ],
    },
    data: { task: "instruction_check" },
    on_finish: (data) => {
      checkAttempt += 1;
      data.attempt = checkAttempt;
      // `response` is null when the debug skip button ended this trial.
      data.correct = data.response?.two_back_rule === "two_back";
    },
  };
  const lastCheckCorrect = () => jsPsych.data.get().filter({ task: "instruction_check" }).last(1).values()[0].correct;
  // Always shown (a conditional trial would leave a gap in trial_index when skipped).
  const checkFeedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => lastCheckCorrect()
      ? `<p>Correct. Next come the three practice blocks.</p>`
      : `<p>That answer was not correct. Please read the instructions again.</p>`,
    choices: () => [lastCheckCorrect() ? "Start the practice" : "Show the instructions again"],
    data: { task: "instruction_check_feedback" },
  };
  const instructionLoop = {
    timeline: [nbackInstructions, instructionCheck, checkFeedback],
    loop_function: () => !lastCheckCorrect(),
  };

  // -------------------------------------------------------------------------
  // n-back sequence construction
  // -------------------------------------------------------------------------
  const randInt = (k) => Math.floor(Math.random() * k);

  // Returns `length` words from `pool` with exactly `nTargets` n-back matches. Each target
  // repeats the word n positions earlier (its cue). Every other word differs from all of the
  // previous three words, so there are no accidental 1-, 2- or 3-back matches (lures).
  function buildSequence(pool, length, n, nTargets) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const used = new Set();
      const isTarget = new Array(length).fill(false);
      const isCue = new Array(length).fill(false);
      let placed = 0;
      for (let tries = 0; placed < nTargets && tries < 1000; tries++) {
        const cue = randInt(length - n);
        const target = cue + n;
        if (used.has(cue) || used.has(target)) continue;
        used.add(cue); used.add(target);
        isCue[cue] = true; isTarget[target] = true;
        placed++;
      }
      if (placed < nTargets) continue;
      const words = [];
      for (let i = 0; i < length; i++) {
        if (isTarget[i]) { words.push(words[i - n]); continue; }
        const recent = words.slice(Math.max(0, i - 3), i);
        const options = pool.filter((w) => !recent.includes(w));
        words.push(options[randInt(options.length)]);
      }
      // Verify: the only n-back matches are the intended targets.
      const ok = words.every((w, i) => (i >= n && w === words[i - n]) === isTarget[i]);
      if (ok) return words.map((word, i) => ({ word, position: i + 1, is_target: isTarget[i], is_cue: isCue[i] }));
    }
    throw new Error("Could not build an n-back sequence");
  }

  // One word: shown for word_ms, then blank until soa_ms. The space bar is accepted throughout
  // (response_ends_trial false keeps the timing fixed); rt is measured from word onset.
  const nbackWord = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      const t = jsPsych.evaluateTimelineVariable("is_target") ? 1 : 0;
      return `<div class="stimulus nback-word" data-target="${t}">${jsPsych.evaluateTimelineVariable("word").toUpperCase()}</div>`;
    },
    choices: [" "],
    stimulus_duration: TIMING.word_ms,
    trial_duration: TIMING.soa_ms,
    response_ends_trial: false,
    save_trial_parameters: { stimulus: false },
    data: {
      task: "nback",
      phase: jsPsych.timelineVariable("phase"),
      block: jsPsych.timelineVariable("block"),
      n_back: jsPsych.timelineVariable("n_back"),
      valence: jsPsych.timelineVariable("valence"),
      position: jsPsych.timelineVariable("position"),
      word: jsPsych.timelineVariable("word"),
      is_target: jsPsych.timelineVariable("is_target"),
      is_cue: jsPsych.timelineVariable("is_cue"),
    },
    on_finish: (data) => {
      data.responded = data.response !== null;
      data.correct = data.responded === data.is_target;
      data.outcome = data.is_target
        ? (data.responded ? "hit" : "miss")
        : (data.responded ? "false_alarm" : "correct_rejection");
    },
  };

  const NBACK_RULE = {
    1: "the same as the word just before it",
    2: "the same as the word two words before it",
    3: "the same as the word three words before it",
  };
  // The pause before each block shows that block's instruction, with a countdown. It cannot be skipped.
  function pauseTrial(block) {
    let timer = null;
    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div class="nback-pause">
          <p>${block.phase === "practice" ? "Practice block" : "Block"} ${block.block} of ${block.n_blocks}</p>
          <h2>${block.n_back}-back</h2>
          <p>Press the <strong>space bar</strong> when the word is ${NBACK_RULE[block.n_back]}.</p>
          <p>The block starts in <span id="nback-countdown">${Math.ceil(TIMING.pause_ms / 1000)}</span> seconds.</p>
        </div>`,
      choices: "NO_KEYS",
      trial_duration: TIMING.pause_ms,
      data: { task: "nback_pause", phase: block.phase, block: block.block, n_back: block.n_back, valence: block.valence },
      on_load: () => {
        const start = performance.now();
        timer = setInterval(() => {
          const el = document.getElementById("nback-countdown");
          if (el) el.textContent = Math.max(0, Math.ceil((TIMING.pause_ms - (performance.now() - start)) / 1000));
        }, 250);
      },
      on_finish: () => clearInterval(timer),
    };
  }

  function blockTimeline(block) {
    return [
      pauseTrial(block),
      { timeline: [nbackWord], timeline_variables: block.items.map((it) => ({ ...block.info, ...it })) },
    ];
  }

  function makeBlock(phase, blockNum, nBlocks, n, valence, pool, length, nTargets) {
    const info = { phase, block: blockNum, n_back: n, valence };
    return { ...info, n_blocks: nBlocks, info, items: buildSequence(pool, length, n, nTargets) };
  }

  // -------------------------------------------------------------------------
  // 4. Practice: one neutral block of each load, in order 1-, 2-, 3-back
  // -------------------------------------------------------------------------
  const practiceBlocks = NBACK.levels.map((n, i) =>
    makeBlock("practice", i + 1, NBACK.levels.length, n, "neutral", PRACTICE_WORDS,
      NBACK.practice_words_per_block, NBACK.practice_targets_per_block));
  const practiceEnd = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>Practice complete</h2>
      <p>The main task works the same way: 27 blocks, each preceded by a 20-second pause that
      tells you which rule (1-, 2- or 3-back) to use. It takes about 18 minutes.</p>`,
    choices: ["Start the main task"],
    data: { task: "practice_end" },
  };

  // -------------------------------------------------------------------------
  // 5. Main task: 3 blocks per load x valence cell (27), n-back level changes every block
  // -------------------------------------------------------------------------
  const cells = [];
  for (const n of NBACK.levels) {
    for (const valence of NBACK.valences) {
      for (let r = 0; r < NBACK.blocks_per_cell; r++) cells.push({ n, valence });
    }
  }
  const blockOrder = jsPsych.randomization.shuffleNoRepeats(cells, (a, b) => a.n === b.n);
  const mainBlocks = blockOrder.map((c, i) =>
    makeBlock("main", i + 1, blockOrder.length, c.n, c.valence, WORDS[c.valence],
      NBACK.words_per_block, NBACK.targets_per_block));
  saver.updateParticipant({ block_order: mainBlocks.map((b) => `${b.n_back}-${b.valence}`) });

  // -------------------------------------------------------------------------
  // 6. Feedback on the participant experience (optional free text)
  // -------------------------------------------------------------------------
  const feedback = {
    type: jsPsychSurveyText,
    preamble: `<p>Thank you for participating in this study. If you would like to help improve this
      study for future participants, please add any feedback, concerns, or issues you experienced
      while completing this study in the free text box below.</p>`,
    questions: [{ prompt: "", name: "feedback", rows: 6, columns: 60, required: false }],
    button_label: "Continue",
    data: { task: "feedback" },
  };

  // -------------------------------------------------------------------------
  // 7. Debrief
  // -------------------------------------------------------------------------
  const debrief = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <h2>Debrief</h2>
      <p>Thank you. In this study we tested whether the emotional valence of words in a working memory task
      affect performance on the working memory task. Every participant saw the same words, but in randomized order.
      Each block contained either words with a positive, negative, or neutral valence.
      If you have questions about this research, contact
      <a href="mailto:${EXPERIMENT.contact_email}">${EXPERIMENT.contact_email}</a>.
      Press the button to save your responses and finish.</p>`,
    choices: ["Finish"],
    data: { task: "debrief" },
  };

  await jsPsych.run([
    consent,
    section("welcome", [instructions]),
    section("n-back instructions", [instructionLoop]),
    section("practice", practiceBlocks.flatMap(blockTimeline)),
    practiceEnd,
    section("main task", mainBlocks.flatMap(blockTimeline)),
    section("feedback", [feedback]),
    debrief,
  ]);
})();
