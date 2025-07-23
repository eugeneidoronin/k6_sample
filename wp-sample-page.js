import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { browser } from 'k6/browser';
import { open } from 'k6/experimental/fs';
import csv from 'k6/experimental/csv';
import exec from 'k6/execution';

// Constants
const BASE_URL = 'http://ubuntu1.cat:30180';
const ENDPOINTS = {
  SAMPLE_PAGE: '/sample-page/',
  SIMPLE_FORM: '/simple-form/',
  ADMIN_AJAX: '/wp-admin/admin-ajax.php'
};

const FORM_BOUNDARY = 'WebKitFormBoundaryBzBiOLOAABeG7PBl';

const HEADERS = {
  "Proxy-Connection": 'keep-alive',
  "Upgrade-Insecure-Requests": '1',
  "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  "Accept-Encoding": 'gzip, deflate',
  "Accept-Language": 'en-GB,en-US;q=0.9,en;q=0.8',
};

// Get scenario parameters from environment variables or use defaults
const simpleFormVUs = __ENV.K6_SCENARIO_SIMPLE_FORM_VUS ? parseInt(__ENV.K6_SCENARIO_SIMPLE_FORM_VUS) : 10;
const simpleFormIterations = __ENV.K6_SCENARIO_SIMPLE_FORM_ITERATIONS ? parseInt(__ENV.K6_SCENARIO_SIMPLE_FORM_ITERATIONS) : 20;
const samplePageRate = __ENV.K6_SCENARIO_SAMPLE_PAGE_RATE ? parseInt(__ENV.K6_SCENARIO_SAMPLE_PAGE_RATE) : 2;
const samplePageDuration = __ENV.K6_SCENARIO_SAMPLE_PAGE_DURATION || '2m';
const uiEnabled = __ENV.K6_SCENARIO_UI_ENABLED === 'true';
const uiIterations = __ENV.K6_SCENARIO_UI_ITERATIONS ? parseInt(__ENV.K6_SCENARIO_UI_ITERATIONS) : 15;

// Create scenarios configuration
const scenarios = {
  simpleForm: {
    executor: 'per-vu-iterations',
    vus: simpleFormVUs,
    iterations: simpleFormIterations,
    maxDuration: '5m',
    exec: 'simpleForm',
    startTime: '20s',
    gracefulStop: '5s',
  },
  samplePage: {
    executor: 'constant-arrival-rate',
    preAllocatedVUs: 100,
    rate: samplePageRate,
    duration: samplePageDuration,
    gracefulStop: '5s'
  }
};

// Only add the UI scenario if enabled
if (uiEnabled) {
  scenarios.browser = {
    executor: 'shared-iterations',
    options: {
      browser: {
        type: 'chromium',
      },
    },
    exec: 'ui',
    iterations: uiIterations
  };
}

export const options = {
  scenarios: scenarios,
  thresholds: {
    'http_req_duration': [
      'p(90) < 3000',
      'p(95) < 4000',
    ],
    'http_req_failed': ['rate < 0.01'],
    'checks': ['rate > 0.95'],
  }
};

// Helper function to create form data
function createFormData(data, boundary) {
  const parts = [
    { name: "wpforms[fields][1][first]", value: data.Name },
    { name: "wpforms[fields][1][last]", value: data.Surname },
    { name: "wpforms[fields][5]", value: "" },
    { name: "wpforms[fields][2]", value: data.Email },
    { name: "wpforms[fields][4]", value: "" },
    { name: "wpforms[fields][3]", value: data.Message || "My comment or my message" },
    { name: "wpforms[id]", value: "8" },
    { name: "page_title", value: "simple-form" },
    { name: "page_url", value: `${BASE_URL}${ENDPOINTS.SIMPLE_FORM}` },
    { name: "url_referer", value: "" },
    { name: "page_id", value: "10" },
    { name: "wpforms[post_id]", value: "10" },
    { name: "wpforms[submit]", value: "wpforms-submit" },
    { name: "wpforms[token]", value: "054f5adcbb5309f422d55e0bd244c68e" },
    { name: "action", value: "wpforms_submit" },
    { name: "start_timestamp", value: "1753010534" },
    { name: "end_timestamp", value: "1753010592" }
  ];
  
  return parts.map(part => 
    `------${boundary}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`
  ).join('') + `------${boundary}--\r\n`;
}

// Load CSV data with error handling
let formDataCsv = [];
try {
  const formDataFile = await open('form-data.csv');
  formDataCsv = await csv.parse(formDataFile, {delimiter: ',', asObjects: true});
  
  if (formDataCsv.length === 0) {
    console.warn('Warning: CSV file loaded but contains no data');
  }
} catch (error) {
  console.error(`Error loading CSV data: ${error.message}`);
  // Provide fallback data
  formDataCsv = [
    { Name: 'John', Surname: 'Doe', Email: 'john@example.com', Message: 'Test message' }
  ];
}

// Default scenario
export default function () {
  const res = http.get(`${BASE_URL}${ENDPOINTS.SAMPLE_PAGE}`, {
    tags: { endpoint: 'sample-page' }
  });
  
  check(res, {
    'Landing on Sample page has been successful': (res) => res.status === 200,
    'Content type is correct': (res) => res.headers['Content-Type'].includes('text/html')
  });

  sleep(3);
}

// Browser scenario
export async function ui() {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}${ENDPOINTS.SAMPLE_PAGE}`, {
      waitUntil: 'load',
    });

    const youlinktext = await page.locator("//p[contains(.,'Have fun!')]").count();

    check(youlinktext, {
      'The Have fun! text has been found': (ylt) => ylt > 0
    });

  } catch (error) {
    console.error(`Browser test error: ${error.message}`);
  } finally {
    await page.close();
  }
  sleep(5);
}

// Form submission scenario
export async function simpleForm() {
  let params;
  let resp;
  
  // Select data row based on iteration
  const dataRow = formDataCsv[exec.scenario.iterationInTest % formDataCsv.length];
  
  group("Landing on a simple form", function () {
    params = {
      headers: HEADERS,
      tags: { endpoint: 'simple-form-get' }
    };

    resp = http.get(`${BASE_URL}${ENDPOINTS.SIMPLE_FORM}`, params);

    check(resp, {
      "Landing on simple form has been successful": (r) => r.status === 200,
      "Page contains form elements": (r) => r.body.includes('wpforms')
    });
  });
  
  group("Submitting simple form", function () {
    const formData = createFormData(dataRow, FORM_BOUNDARY);
    
    params = {
      headers: {
        ...HEADERS,
        "Content-Type": `multipart/form-data; boundary=----${FORM_BOUNDARY}`,
      },
      tags: { endpoint: 'simple-form-post' }
    };

    resp = http.post(
      `${BASE_URL}${ENDPOINTS.ADMIN_AJAX}`,
      formData,
      params
    );

    check(resp, {
      "The form has been submitted successfully": (r) => r.status === 200
    });
  });
  
  sleep(3);
}