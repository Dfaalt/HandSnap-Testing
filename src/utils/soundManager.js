import { Howl } from "howler";

const sounds = {
  SS: new Howl({ src: ["/sounds/SS.wav"], volume: 1 }),
  transfer_SS: new Howl({ src: ["/sounds/transfer_SS.wav"], volume: 1 }),
};

export const playSound = (type) => {
  const sound = sounds[type];
  if (sound) {
    sound.stop(); // reset ulang kalau masih bunyi
    sound.play();
  }
};
