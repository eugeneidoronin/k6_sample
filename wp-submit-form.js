import { group, sleep, check } from "k6";
import http from "k6/http";
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';


export const options = {

};


// Use SharedArray to load CSV data only once and share across all VUs
const formDataCsv = new SharedArray('form-data', function () {
  return papaparse.parse(open('./form-data.csv'), { delimiter: ',', header: true }).data;
});

export default function () {
  let params;
  let resp;
  let url;
  const correlation_vars = {};

  // Get data for this iteration
  const dataIndex = exec.scenario.iterationInTest % formDataCsv.length;
  let i = formDataCsv[dataIndex];
  
  // Debug output showing which data is being used
  console.log(`[VU:${exec.vu.idInTest}] [Iteration:${exec.scenario.iterationInTest}] Using CSV row ${dataIndex + 1}/${formDataCsv.length}:`);
  console.log(`[VU:${exec.vu.idInTest}] Data: Name="${i.Name}", Surname="${i.Surname}", Email="${i.Email}", Message="${i.Message || 'My comment or my message'}"`);

  group("Landing on a simple form", function () {
    params = {
      headers: {
        "Proxy-Connection": `keep-alive`,
        "Upgrade-Insecure-Requests": `1`,
        Accept: `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`,
        "Accept-Encoding": `gzip, deflate`,
        "Accept-Language": `en-GB,en-US;q=0.9,en;q=0.8`,
      },
      cookies: {},
    };

    url = http.url`http://ubuntu1.cat:30180/simple-form/`;
    resp = http.request("GET", url, null, params);

    check(resp, {"status equals 200": (r) => r.status === 200});
  });
  group("Submitting simple form", function () {
    console.log(`[VU:${exec.vu.idInTest}] Submitting form with data: ${i.Name} ${i.Surname} (${i.Email})`);
    
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

    params = {
      headers: {
        "Proxy-Connection": `keep-alive`,
        "X-Requested-With": `XMLHttpRequest`,
        Accept: `application/json, text/javascript, */*; q=0.01`,
        "Content-Type": `multipart/form-data; boundary=----WebKitFormBoundaryBzBiOLOAABeG7PBl`,
        Origin: `http://ubuntu1.cat:30180`,
        Referer: `http://ubuntu1.cat:30180/simple-form/`,
        "Accept-Encoding": `gzip, deflate`,
        "Accept-Language": `en-GB,en-US;q=0.9,en;q=0.8`,
      },
      cookies: {},
    };

    resp = http.request(
        "POST",
        url,
        formData,
        params,
    );
    url = http.url`http://ubuntu1.cat:30180/wp-admin/admin-ajax.php`;

    check(resp, { "status equals 200": (r) => r.status === 200 });
  });
  sleep(1);
}
