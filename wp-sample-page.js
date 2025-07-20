import http from 'k6/http';
import {sleep, check, group} from 'k6';
import {browser} from 'k6/browser';
import { open } from 'k6/experimental/fs';
import csv from 'k6/experimental/csv';
import exec from 'k6/execution';

export const options = {
        // run the tests with different scenarios
        scenarios: {
            // Navigate to a Simple form page and submit it
            simpleForm: {
                executor: 'per-vu-iterations',
                vus: 10,
                iterations: 20,
                maxDuration: '30s',
                exec: 'simpleForm',
                startTime: '20s',
                gracefulStop: '5s',
            },
            // Navigate to a Sample page
            samplePage: {
                executor: 'constant-arrival-rate',
                preAllocatedVUs: 100,
                rate: 2,
                duration: '1m',
                gracefulStop: '5s'

            },
            // Check the Smample page from browser
            browser: {
                executor: 'shared-iterations',
                options: {
                    browser: {
                        type: 'chromium',
                    },
                },
                exec: 'ui',
                iterations: 20
            },
        },

        thresholds: {
            // Response time thresholds
            'http_req_duration':
                [
                    'p(90) < 3000',    // 90% of requests should be below 3000 ms
                    'p(95) < 4000',    // 95% of requests should be below 4000 ms
                ],

            // Error rate threshold
            'http_req_failed':
                ['rate < 0.01'],  // Less than 1% of requests should fail

            // Checks success rate
            'checks':
                ['rate > 0.95'],  // At least 95% of checks should pass

        }
    };

export default function () {
    const res = http.get('http://ubuntu1.cat:30180/sample-page/');
    check(res,
        {'Landing on Sample page has been successful': (res) => res.status == 200});

    sleep(1);
}

export async function ui() {
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


const headers = {
    "Proxy-Connection": `keep-alive`,
    "Upgrade-Insecure-Requests": `1`,
    Accept: `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`,
    "Accept-Encoding": `gzip, deflate`,
    "Accept-Language": `en-GB,en-US;q=0.9,en;q=0.8`,
};

const formDatFile = await open('form-data.csv');
const formDataCsv = await csv.parse(formDatFile, { delimiter: ',', asObjects: true });

export async function simpleForm() {
    let params;
    let resp;
    let url;

    let i = formDataCsv[exec.scenario.iterationInTest % formDataCsv.length];
    group("Landing on a simple form", function () {
        params = {
            headers: headers,
            cookies: {},
        };

        url = http.url`http://ubuntu1.cat:30180/simple-form/`;
        resp = http.request("GET", url, null, params);

        check(resp, {"Landing on simple form has been successful": (r) => r.status === 200});
    });

    const formData = `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][1][first]"\r\n\r\n${i.Name}\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][1][last]"\r\n\r\n${i.Surname}\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][5]"\r\n\r\n\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][2]"\r\n\r\n${i.Email}\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][4]"\r\n\r\n\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[fields][3]"\r\n\r\n${i.Message || "My comment or my message"}\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[id]"\r\n\r\n8\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="page_title"\r\n\r\nsimple-form\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="page_url"\r\n\r\nhttp://ubuntu1.cat:30180/simple-form/\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="url_referer"\r\n\r\n\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="page_id"\r\n\r\n10\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[post_id]"\r\n\r\n10\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[submit]"\r\n\r\nwpforms-submit\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="wpforms[token]"\r\n\r\n054f5adcbb5309f422d55e0bd244c68e\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="action"\r\n\r\nwpforms_submit\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="start_timestamp"\r\n\r\n1753010534\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl\r\n` +
        `Content-Disposition: form-data; name="end_timestamp"\r\n\r\n1753010592\r\n` +
        `------WebKitFormBoundaryBzBiOLOAABeG7PBl--\r\n`;

    group("Submitting simple form", function () {
        params = {
            headers: {
                ...headers,
                "Content-Type": `multipart/form-data; boundary=----WebKitFormBoundaryBzBiOLOAABeG7PBl`,
            },
            cookies: {},
        };

        url = http.url`http://ubuntu1.cat:30180/wp-admin/admin-ajax.php`;
        resp = http.request(
            "POST",
            url,
            formData,
            params,
        );

        check(resp, { "The form has been submitted successfully": (r) => r.status === 200 });
    });
    sleep(1);
}