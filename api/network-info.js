// Muzo Cloud Serverless API: /api/network-info

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'muzo.app';
  const mobileUrl = `${proto}://${host}`;

  return res.status(200).json({
    lanIp: host,
    port: proto === 'https' ? 443 : 80,
    mobileUrl: mobileUrl,
    cloud: true
  });
};
