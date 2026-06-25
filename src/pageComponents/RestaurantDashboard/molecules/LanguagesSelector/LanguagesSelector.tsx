import { useTranslation } from "react-i18next";

export const LanguagesSelector = () => {
  const { t } = useTranslation();

  return (
    <p className="text-sm text-muted-foreground">
      {t("restaurantDashboard.availableLanguages")} English
    </p>
  );
};
