import { useTranslation } from "react-i18next";

export const DefaultLanguagesSelector = () => {
  const { t } = useTranslation();

  return (
    <p className="text-sm text-muted-foreground">
      {t("restaurantDashboard.defaultLanguage")}: English
    </p>
  );
};
