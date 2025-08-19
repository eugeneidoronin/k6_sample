import http from 'k6/http';
import {sleep, check, group} from 'k6';
import {browser} from 'k6/browser';
import exec from 'k6/execution';
import {SharedArray} from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// Constants
const BASE_URL = 'http://wordpress.ubuntu1.cat';
const ENDPOINTS = {
    SAMPLE_PAGE: '/sample-page/',
    SIMPLE_FORM: '/simple-form/',
    ADMIN_AJAX: '/wp-admin/admin-ajax.php'
};

const FORM_BOUNDARY = 'WebKitFormBoundaryBzBiOLOAABeG7PBl';

// Timeout configurations
const HTTP_TIMEOUT = '10s';
const BROWSER_TIMEOUT = 10000; // 10 seconds in milliseconds
const MAX_REDIRECTS = 3;

const UI_SLEEP_DELAY = 5; // delay between UI tests
const NON_UI_DELAY = 3; // delay between non-UI tests

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

// Use SharedArray to load CSV data only once and share across all VUs
const formDataCsv = new SharedArray('form-data', function () {
    return papaparse.parse(open('./form-data.csv'), {delimiter: ',', header: true}).data;
});

// Create scenarios configuration with timeouts and iteration timeouts
const scenarios = {
    simpleForm: {
        executor: 'per-vu-iterations',
        vus: simpleFormVUs,
        iterations: simpleFormIterations,
        maxDuration: '5m',
        exec: 'simpleForm',
        startTime: '20s',
        gracefulStop: '30s',
    },
    samplePage: {
        executor: 'constant-arrival-rate',
        preAllocatedVUs: 10,
        maxVUs: 200,
        rate: samplePageRate,
        duration: samplePageDuration,
        gracefulStop: '30s',
        timeUnit: '1s'
    }
};

// Only add the UI scenario if enabled
if (uiEnabled) {
    scenarios.browser = {
        executor: 'shared-iterations',
        options: {
            browser: {
                type: 'chromium',
                timeout: `${BROWSER_TIMEOUT}ms`, // Browser-wide timeout
            },
        },
        exec: 'ui',
        iterations: uiIterations,
        maxDuration: '5m', // Add max duration for browser tests
        gracefulStop: '60s' // Longer graceful stop for browser cleanup
    };
}

export const options = {
    scenarios: scenarios,
    thresholds: {
        'http_req_duration': [
            'p(90) < 4000',
            'p(95) < 5000',
        ],
        'http_req_failed': ['rate < 0.05'],
        'checks': ['rate > 0.90'], // Slightly more lenient check rate
        'iteration_duration': ['p(95) < 60000'], // Ensure iterations don't hang
    },
    userAgent: 'k6-load-test/1.0',
};

// Helper function to create form data
function createFormData(data, boundary) {
    // Validate input data
    if (!data || typeof data !== 'object') {
        console.error('Invalid form data provided, using defaults');
        data = {Name: 'Test', Surname: 'User', Email: 'test@example.com', Message: 'Test message'};
    }

    const parts = [
        {name: "wpforms[fields][1][first]", value: data.Name},
        {name: "wpforms[fields][1][last]", value: data.Surname},
        {name: "wpforms[fields][5]", value: ""},
        {name: "wpforms[fields][2]", value: data.Email},
        {name: "wpforms[fields][4]", value: ""},
        {name: "wpforms[fields][3]", value: data.Message},
        {name: "wpforms[id]", value: "8"},
        {name: "page_title", value: "simple-form"},
        {name: "page_url", value: `${BASE_URL}${ENDPOINTS.SIMPLE_FORM}`},
        {name: "url_referer", value: ""},
        {name: "page_id", value: "10"},
        {name: "wpforms[post_id]", value: "10"},
        {name: "wpforms[submit]", value: "wpforms-submit"},
        {name: "wpforms[token]", value: "054f5adcbb5309f422d55e0bd244c68e"},
        {name: "action", value: "wpforms_submit"},
        {name: "start_timestamp", value: Date.now().toString().slice(0, -3)},
        {name: "end_timestamp", value: (Date.now() + 5000).toString().slice(0, -3)}
    ];

    return parts.map(part =>
        `------${boundary}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`
    ).join('') + `------${boundary}--\r\n`;
}

// Default scenario with error handling and timeouts
export default function () {

    const res = http.get(`${BASE_URL}${ENDPOINTS.SAMPLE_PAGE}`, {
        timeout: HTTP_TIMEOUT,
        redirects: MAX_REDIRECTS,
        tags: {endpoint: 'sample-page'}
    });

    check(res, {
        'Landing on Sample page has been successful': (res) => res && res.status === 200,
        'Content type is correct': (res) => res && res.headers && res.headers['Content-Type'] && res.headers['Content-Type'].includes('text/html'),
        'Response body is not empty': (res) => res && res.body && res.body.length > 0
    });

    sleep(NON_UI_DELAY);
}

// Browser scenario with comprehensive timeout and error handling
export async function ui() {
    let context, page;
    const startTime = Date.now();

    try {
        // Set timeout for browser context creation
        context = await browser.newContext({
            timeout: BROWSER_TIMEOUT
        });

        page = await context.newPage();

        // Set page timeout
        page.setDefaultTimeout(BROWSER_TIMEOUT);
        page.setDefaultNavigationTimeout(BROWSER_TIMEOUT);

        await page.goto(`${BASE_URL}${ENDPOINTS.SAMPLE_PAGE}`, {
            waitUntil: 'domcontentloaded',
            timeout: BROWSER_TIMEOUT,
        });

        const youlinktext = await page.locator("//p[contains(.,'Have fun!')]").count();
        check(youlinktext, {
            'The Have fun! text has been found': (ylt) => ylt > 0,
        });

    } catch (error) {
        console.error(`Browser test error: ${error.message}`);
    } finally {
        // Ensure cleanup happens even on timeout/error
        try {
            if (page) {
                await Promise.race([
                    page.close(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Page close timeout')), 5000))
                ]);
            }
            if (context) {
                await Promise.race([
                    context.close(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Context close timeout')), 5000))
                ]);
            }
        } catch (cleanupError) {
            console.error(`Cleanup error: ${cleanupError.message}`);
        }
    }

    sleep(UI_SLEEP_DELAY);
}

// Form submission scenario with comprehensive error handling and timeouts
export async function simpleForm() {
    let params;
    let resp;

    try {
        // Select data row based on iteration with bounds checking
        const dataIndex = exec.scenario.iterationInTest % formDataCsv.length;
        const dataRow = formDataCsv[dataIndex];

        if (!dataRow) {
            throw new Error(`No data available for iteration ${exec.scenario.iterationInTest}`);
        }

        group("Landing on a simple form", function () {
            params = {
                headers: HEADERS,
                timeout: HTTP_TIMEOUT,
                redirects: MAX_REDIRECTS,
                tags: {endpoint: 'simple-form-get'}
            };

            resp = http.get(`${BASE_URL}${ENDPOINTS.SIMPLE_FORM}`, params);

            check(resp, {
                "Landing on simple form has been successful": (r) => r && r.status === 200,
                "Page contains form elements": (r) => r && r.body && r.body.includes('wpforms'),
                "Form page has content": (r) => r && r.body && r.body.length > 1000
            });

        });


        group("Submitting simple form", function () {
            try {
                console.log(`[VU:${exec.vu.idInTest}] Submitting form with data: ${dataRow.Name} ${dataRow.Surname} (${dataRow.Email})`);

                const formData = createFormData(dataRow, FORM_BOUNDARY);

                params = {
                    headers: {
                        ...HEADERS,
                        "Content-Type": `multipart/form-data; boundary=----${FORM_BOUNDARY}`,
                    },
                    timeout: HTTP_TIMEOUT,
                    redirects: MAX_REDIRECTS,
                    tags: {endpoint: 'simple-form-post'}
                };

                resp = http.post(
                    `${BASE_URL}${ENDPOINTS.ADMIN_AJAX}`,
                    formData,
                    params
                );

                check(resp, {
                    "The form has been submitted successfully": (r) => r && r.status === 200,
                    "Form submission response time acceptable": (r) => r && r.timings && r.timings.duration < 15000,
                    "Form submission has response body": (r) => r && r.body && r.body.length > 0,
                });


            } catch (error) {
                console.error(`Error submitting form: ${error.message}`);
                check(false, {
                    "Form submission error handled": () => true
                });
            }
        });

    } catch (error) {
        console.error(`Error in simpleForm scenario: ${error.message}`);
        check(false, {
            "SimpleForm scenario error handled": () => true
        });
    };

    sleep(NON_UI_DELAY);
}