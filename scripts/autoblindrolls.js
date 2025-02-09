// Import Stuff
import { registerSettings } from "./settings.js";
import { getSkillNames, getSkillAbbreviations } from "./skills.js";
import { getBrSaveNames } from "./saves.js";

// Register Game Settings & Listeners
Hooks.once("init", () => {
  registerSettings();

  $(document).on(
    "click",
    ".crash-blind-roll-skills-help-card-toggle-btn",
    (ev) => {
      ev.preventDefault();
      game.settings.set("blind-roll-skills", "showHelpCards", false);
      ui.notifications.notify(
        "Crash's Automatic Blind Rolls (5e): " +
        game.i18n.localize("BLINDROLLSKILLS.HelpCardsDisabled")
      );
    }
  );
});

// Make API available to others
Hooks.on(`ready`, () => {
  globalThis.AutoBlindRolls = autoBlindRolls();
});

// Blind-ify BetterRolls5e Roll Cards
// Better Rolls constructs its own chat cards, with the skill names in the header field.
// We compare a list of formatted skill names to that header. If there's a match, we make it blind.
Hooks.on("messageBetterRolls", (roll, chatData) => {
  let skillsToBlind = getSkillNames();
  let cardTitle = getBrCardTitle(chatData);
  let makeRollBlind = skillsToBlind.includes(cardTitle);

  if (makeRollBlind) {
    let gmUsers = ChatMessage.getWhisperRecipients("GM");
    let gmUserIds = gmUsers.map((u) => u.data._id);
    chatData.whisper = gmUserIds;
    chatData.rollMode = "blindroll";
    chatData.blind = true;
    createAlertMsg();
  }
});

Hooks.on("dnd5e.rollSkill", (actor, roll, skillAbbr) => {
  let skillsToBlind = getSkillAbbreviations();
  let makeRollBlind = skillsToBlind.includes(skillAbbr);

  if (makeRollBlind) {
    roll.options.rollMode = "blindroll";
  }
});

// Catch chat message creations and make em blind if we need to
Hooks.on("preCreateChatMessage", (msg, options, userId) => {
  let makeRollBlind = false;
  let skillId = null;
  let saveId = null;
  let isInitiative = false;
  let isDeathSave = false;
  let isAttack = false;

  if (msg.data.flags) {
    skillId = msg.data.flags.dnd5e?.roll?.skillId;
    saveId = msg.data.flags.dnd5e?.roll?.saveId;
    isInitiative = msg.data.flags.core?.initiativeRoll;
    isDeathSave = msg.data.flags.dnd5e?.roll?.type === "death";
    isAttack = msg.data.flags.dnd5e?.roll?.type === "attack";
  }

  // Blind-ify Default 5e & MARS 5e Roll Cards
  // We check the dnd5e flags in the msg to see if it contains any of the skills,
  // or is a death save, or is an initiative roll, and hide accordingly
  if (skillId) {
    makeRollBlind = AutoBlindRolls.makeSkillBlind(skillId);
  } else if (saveId) {
    makeRollBlind = AutoBlindRolls.makeSaveBlind(saveId);
  } else if (isInitiative) {
    makeRollBlind = AutoBlindRolls.makeInitiativeBlind();
  } else if (isDeathSave) {
    makeRollBlind = AutoBlindRolls.makeDeathSaveBlind();
  } else if (isAttack) {
    makeRollBlind = AutoBlindRolls.makeAttackBlind();
  }

  // If we need to make the roll blindly, do it.
  if (makeRollBlind) {
    let gmUsers = ChatMessage.getWhisperRecipients("GM");
    let gmUserIds = gmUsers.map((u) => u.data._id);
    let updates = {
      blind: true,
      whisper: gmUserIds,
    };
    msg.data.update(updates);

    createAlertMsg();
  }
});

// Digs through the BR chatData flags to find the header field, then gets the title.
// This is really hacky. TODO: Ask Supe if there's a better way to do this
function getBrCardTitle(card) {
  let title = null;
  if (card.flags?.betterrolls5e?.entries) {
    let entries = card.flags.betterrolls5e.entries;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].type == "header") {
        title = entries[i].title;
        break;
      }
    }
  }
  return title;
}

// Creates a chat message that explains to the user why the roll was made blindly.
// Does not display if the Show Help Cards client setting is disabled.
function createAlertMsg() {
  if (game.settings.get("blind-roll-skills", "showHelpCards")) {
    renderTemplate(
      "modules/blind-roll-skills/templates/helpCard.html",
      {}
    ).then((html) => {
      let options = {
        whisper: [game.user.id],
        speaker: {
          alias: game.i18n.localize("BLINDROLLSKILLS.ChatCardSpeaker"),
        },
        content: html,
      };
      ChatMessage.create(options);
    });
  }
}

// Open up for other people to use
export function autoBlindRolls() {
  // skill is a string, abbreviation for the skill. Ex: 'acr', 'ste', etc
  function makeSkillBlind(skill) {
    if (!skill) {
      console.error(
        "Crash's Automatic Blind Rolls (5e): No skill abbreviation provided to AutoBlindRolls.makeSkillBlind"
      );
      return false;
    }
    let skillsToBlind = getSkillAbbreviations();
    return skillsToBlind.includes(skill);
  }

  // Hiding saves isn't a currently available feature; its existence here is purely so module authors
  // who wish to support the feature when it does go live can implement it ahead of time.
  // The bulk of what this method will do upon release is commented out here for your viewing pleasure.
  function makeSaveBlind() {
    // return game.settings.get("blind-roll-skills", "hideSaves");
    return false;
  }

  function makeDeathSaveBlind() {
    return game.settings.get("blind-roll-skills", "hideDeathSaves");
  }

  function makeInitiativeBlind() {
    return game.settings.get("blind-roll-skills", "hideInitiative");
  }

  // Hiding attacks isn't a currently available feature; its existence here is purely so module authors
  // who wish to support the feature when it does go live can implement it ahead of time.
  // The bulk of what this method will do upon release is commented out here for your viewing pleasure.
  function makeAttackBlind() {
    //return game.settings.get("blind-roll-skills", "hideAttacks");
    return false;
  }

  return {
    makeSkillBlind: makeSkillBlind,
    makeSaveBlind: makeSaveBlind,
    makeDeathSaveBlind: makeDeathSaveBlind,
    makeInitiativeBlind: makeInitiativeBlind,
    makeAttackBlind: makeAttackBlind,
  };
}
