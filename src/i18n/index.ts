import { type Namespace, createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next/initReactI18next";

import { getOptions, fallbackLng, type Language } from "./settings";

const initI18next = async (language: Language, namespace?: Namespace) => {
  // on server side we create a new instance for each render, because during compilation everything seems to be executed in parallel
  const i18nInstance = createInstance();

  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (resourceLanguage: string, resourceNamespace: string) =>
          import(`./locales/${resourceLanguage}/${resourceNamespace}.ts`),
      ),
    )
    .init(getOptions(language, namespace));

  return i18nInstance;
};

export function detectLanguage() {
  return fallbackLng;
}

export async function useServerTranslation(namespace?: Namespace) {
  const language = detectLanguage();
  const i18nextInstance = await initI18next(language, namespace);

  return {
    t: i18nextInstance.getFixedT(language, namespace),
    i18n: i18nextInstance,
    language: language,
  };
}
