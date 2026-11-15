import React, { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

/**
 * Root HTML shell for Expo Router static web export.
 * This runs only at static export/build time (Node.js).
 */
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Style reset for full-screen React Native web apps using <ScrollView /> */}
        <ScrollViewStyleReset />

        {/* PWA / Homescreen Metadata */}
        <title>Penny Wise</title>
        <meta name="application-name" content="Penny Wise" />
        <meta name="apple-mobile-web-app-title" content="Penny Wise" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#EDF6F2" />

        {/* Homescreen App Icons */}
        <link rel="icon" type="image/png" href="/Finance-App/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/Finance-App/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/Finance-App/apple-touch-icon.png" />
        <link rel="manifest" href="/Finance-App/manifest.json" />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                background-color: #EDF6F2;
                -webkit-text-size-adjust: 100%;
                touch-action: manipulation;
              }
              #root {
                display: flex;
                flex-direction: column;
                min-height: 100%;
              }
            `,
          }}
        />

        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
