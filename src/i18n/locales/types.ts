import type commonMessages from "./en/common";
import type zodMessages from "./en/zod";

export type Resources = {
  common: typeof commonMessages;
  zod: typeof zodMessages;
};
