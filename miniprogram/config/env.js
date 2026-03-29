/** 在云开发控制台复制环境 ID，替换下方占位符 */
const CLOUD_ENV_ID = 'neverbroke-5g1p5xyr29273bab'

const CLOUD_ENV_PLACEHOLDER = 'your-cloud-env-id'

function isCloudEnvConfigured() {
  return Boolean(CLOUD_ENV_ID && CLOUD_ENV_ID !== CLOUD_ENV_PLACEHOLDER)
}

module.exports = {
  CLOUD_ENV_ID,
  CLOUD_ENV_PLACEHOLDER,
  isCloudEnvConfigured,
}