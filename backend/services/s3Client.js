const { S3Client } = require('@aws-sdk/client-s3');

let s3Client;

function getS3Client() {
  if (!process.env.AWS_REGION) {
    throw new Error('Missing AWS_REGION environment variable');
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }

  return s3Client;
}

module.exports = {
  getS3Client,
};
