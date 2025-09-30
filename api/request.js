import config from '../config';

const { baseUrl } = config;
const delay = config.isMock ? 500 : 0;

function request(url, method = 'GET', data = {}) {
  const header = { 'content-type': 'application/json' };
  const tokenString = wx.getStorageSync('access_token');
  if (tokenString) header.Authorization = `Bearer ${tokenString}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: (baseUrl || '') + url,
      method,
      data,
      dataType: 'json',
      header,
      success(res) {
        setTimeout(() => {
          const status = res && (res.statusCode || res.code);
          if (status === 200) resolve(res.data || res);
          else reject(res);
        }, delay);
      },
      fail(err) {
        setTimeout(() => reject(err), delay);
      },
    });
  });
}

export default request;

