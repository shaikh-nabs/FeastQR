"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { z } from "zod";
import { getOptions } from "~/i18n/settings";
import { zodI18nMap } from "zod-i18n-map";
import zodMessages from "~/i18n/locales/en/zod";
import messages from "~/i18n/locales/en/common";

void i18next.use(initReactI18next).init({
  ...getOptions(),
  resources: {
    en: {
      zod: zodMessages,
      common: messages,
    },
  },
  lng: "en",
});
z.setErrorMap(zodI18nMap);
export const I18NextProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
