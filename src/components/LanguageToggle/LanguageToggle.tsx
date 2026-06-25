import { Button } from "~/components/ui/button";
import { Icons } from "~/components/Icons";

export function LanguageToggle() {
  return (
    <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
      <Icons.languages />
      <span className="sr-only">English</span>
    </Button>
  );
}
