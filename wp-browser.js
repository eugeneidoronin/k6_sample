import { browser } from 'k6/browser';
import { check } from 'https://jslib.k6.io/k6-utils/1.5.0/index.js';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      options: {
        browser: {
          type: 'chromium',
        },
      },
      iterations: 100,
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
  },
};

export default async function () {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('http://ubuntu1.cat:30180/sample-page/', {
      waitUntil: 'load',
    });

    const youlinktext = await page.locator("//p[contains(.,'Have fun!')]").count();

    check(youlinktext,
        {'The Have fun! text has been found':
              (ylt) => ylt > 0 });


  } finally {
    await page.close();
  }
}