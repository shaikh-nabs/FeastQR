import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormInput } from "~/components/FormInput/FormInput";
import { Button } from "~/components/ui/button";
import { Form, FormField } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { getDefaultLanguage } from "~/utils/getDefaultLanguage";
import {
  type AddCategoryFormValues,
  addCategoryValidationSchema,
} from "./CategoryForm.schema";

export const CategoryForm = ({
  defaultValues,
  onClose,
}: {
  defaultValues?: Partial<AddCategoryFormValues>;
  onClose: () => void;
}) => {
  const { mutateAsync } = api.menus.upsertCategory.useMutation();
  const { t } = useTranslation();
  const utils = api.useContext();

  const form = useForm<AddCategoryFormValues>({
    defaultValues: {
      translatedCategoriesData: [],
      ...defaultValues,
    },
    resolver: zodResolver(addCategoryValidationSchema),
  });
  const { slug } = useParams() as { slug: string };
  const { data: menuData, isLoading } = api.menus.getMenuBySlug.useQuery({
    slug,
  });
  const onSubmit = async (values: AddCategoryFormValues) => {
    if (!menuData) return;

    await mutateAsync({ ...values, menuId: menuData.id });
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
        <div className="flex flex-col gap-4 rounded-b-lg bg-muted p-4">
          <Input
            {...form.register("translatedCategoriesData.0.languageId")}
            value={initialLanguage.languageId}
            className="hidden"
          />
          <FormField
            control={form.control}
            name="translatedCategoriesData.0.name"
            render={({ field }) => (
              <FormInput
                label={`${t("dishForm.dishName")} (${lang.languages.isoCode})`}
              >
                <Input {...field} placeholder="Burgery" />
              </FormInput>
            )}
          />
        </div>
        <Button loading={form.formState.isSubmitting} type="submit">
          {t("categoryForm.save")}
        </Button>
      </form>
    </Form>
  );
};
