"use client";

import { ThemeProvider } from "next-themes";
import {
  AnalyticsProvider,
  UmamiAnalyticsProvider,
} from "./AnalyticsProvider/AnalyticsProvider";
import React from "react";
import { I18NextProvider } from "./I18NextProvider/I18NextProvider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <I18NextProvider>
      <ThemeProvider attribute="class" forcedTheme="light">
        {children}
      </ThemeProvider>
      <AnalyticsProvider />
      <UmamiAnalyticsProvider />
    </I18NextProvider>
  );
}
