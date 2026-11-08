import { expect, it } from "vite-plus/test";
import { makeSpeechTextCorrector } from "./customWords.ts";

it("does not rewrite ordinary words that only sound like a term", () => {
  const dictionary = [{ term: "Claude", aliases: [] }];
  const correct = makeSpeechTextCorrector(["Claude"], dictionary);

  expect(correct("The cloud service is down.")).toBe("The cloud service is down.");
});

it("does not drop the words next to a term", () => {
  const dictionary = [{ term: "Codex", aliases: [] }];
  const correct = makeSpeechTextCorrector(["Codex"], dictionary);

  expect(correct("The code is fine.")).toBe("The code is fine.");
});

it("replaces a listed spelling and its aliases", () => {
  const dictionary = [{ term: "T3 Code", aliases: ["tree code", "T three code"] }];
  const correct = makeSpeechTextCorrector(["T3 Code"], dictionary);

  expect(correct("Open tree code and T three code.")).toBe("Open T3 Code and T3 Code.");
});

it("matches a long term one letter off", () => {
  const dictionary = [{ term: "McDonald’s", aliases: [] }];
  const correct = makeSpeechTextCorrector(["McDonald’s"], dictionary);

  expect(correct("I ate at mac donalds.")).toBe("I ate at McDonald’s.");
});

it("does not rewrite a short word one letter off a term", () => {
  const dictionary = [{ term: "Effect", aliases: [] }];
  const correct = makeSpeechTextCorrector(["Effect"], dictionary);

  expect(correct("The effects are fine.")).toBe("The effects are fine.");
});

it("matches a listed spelling in any letter case", () => {
  const dictionary = [{ term: "T3 Code", aliases: [] }];
  const correct = makeSpeechTextCorrector(["T3 Code"], dictionary);

  expect(correct("open t3 code now")).toBe("open T3 Code now");
});
