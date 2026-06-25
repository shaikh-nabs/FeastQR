"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { FormInput } from "~/components/FormInput/FormInput";
import { Button } from "~/components/ui/button";
import { Form, FormField } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { getDefaultLanguage } from "~/utils/getDefaultLanguage";
import { useTranslation } from "react-i18next";
import { api } from "~/trpc/react";
import {
  type AddDishVariantFormValues,
  dishVariantValidationSchema,
} from "./VariantForm.schema";

export const DishVariantForm = ({
  defaultValues,
  onClose,
  dishId,
}: {
  defaultValues?: Partial<AddDishVariantFormValues>;
  onClose: () => void;
  dishId: string;
}) => {
  const form = useForm<AddDishVariantFormValues>({
    defaultValues: {
      translatedVariant: [],
      ...defaultValues,
    },
    resolver: zodResolver(dishVariantValidationSchema),
  });
  const { slug } = useParams() as { slug: string };
  const { data: menuData, isLoading } = api.menus.getMenuBySlug.useQuery({
    slug,
  });
  const { t } = useTranslation();
  const utils = api.useContext();

  const { mutateAsync } = api.menus.upsertDishVariant.useMutation();

  const onSubmit = async (values: AddDishVariantFormValues) => {
    await mutateAsync({ ...values, dishId: dishId });
    utils.menus.invalidate();
    onClose();
  };

  if (isLoading || !menuData) return null;

  const initialLanguage = getDefaultLanguage(menuData.menuLanguages);
  const lang = menuData.menuLanguages[0]!;

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-b-lg bg-muted p-4">
            <Input
              {...form.register("translatedVariant.0.languageId")}
              value={initialLanguage.languageId}
              className="hidden"
            />
            <FormField
              control={form.control}
              name="translatedVariant.0.name"
              render={({ field }) => (
                <FormInput
                  label={`${t("dishVariantForm.variantName")} (${lang.languages.isoCode})`}
                >
                  <Input
                    {...field}
                    placeholder={t("dishVariantForm.variantNamePlaceholder")}
                  />
                </FormInput>
              )}
            />
            <FormField
              control={form.control}
              name="translatedVariant.0.description"
              render={({ field }) => (
                <FormInput
                  label={`${t("dishVariantForm.variantDescription")} (${lang.languages.isoCode})`}
                >
                  <Input
                    {...field}
                    placeholder={t(
                      "dishVariantForm.variantDescriptionPlaceholder",
                    )}
                  />
                </FormInput>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormInput label={t("dishVariantForm.priceInPLN")}>
                <Input {...field} type="number" placeholder="10.99" />
              </FormInput>
            )}
          />
        </div>
        <Button loading={form.formState.isSubmitting} type="submit">
          {t("menuForm.save")}
        </Button>
      </form>
    </Form>
  );
};
