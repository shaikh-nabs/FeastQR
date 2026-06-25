"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";

import { type AppRouter } from "~/server/api/root";
import { getUrl, transformer } from "./shared";
import { supabase } from "~/server/supabase/supabaseClient";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: {
  children: React.ReactNode;
  headers: Headers;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer,

      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          url: getUrl(),
          async headers() {
            const heads = new Map(props.headers);
            const { data } = await supabase().auth.getSession();

            if (data.session) {
              heads.set("authorization", data.session.access_token);
            }

            heads.set("x-trpc-source", "react");

            return Object.fromEntries(heads);
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
