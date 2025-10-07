import { getTimer } from "./timer-store.js";
import Constants from "../constants.js";
const { TIMER_MODES, SESSION_TYPES } = Constants

let isPlaying = false;

export async function handleSound() {
  let timer = getTimer();
  
  if(
    !timer.soundEnabled
    || timer.mode !== TIMER_MODES.RUNNING
    || timer.sessionType !== SESSION_TYPES.WORK
  ) {
    stopAudio();
    return;
  }

  if(isPlaying) return;

  playAudio();
}

function stopAudio(){
  console.log("stop");
}

function playAudio(){
  console.log("play");
}