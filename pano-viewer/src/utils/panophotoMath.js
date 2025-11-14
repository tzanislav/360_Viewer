export const normalizeId = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value._id) {
    if (typeof value._id.toHexString === 'function') {
      return value._id.toHexString();
    }

    if (typeof value._id.toString === 'function') {
      return value._id.toString();
    }
  }

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return '';
};

export const toFiniteOr = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const calculateAzimuthDegrees = (source, target) => {
  if (!source || !target) {
    return 0;
  }

  const sourceX = toFiniteOr(source?.xPosition, 0);
  const sourceY = toFiniteOr(source?.yPosition, 0);
  const targetX = toFiniteOr(target?.xPosition, 0);
  const targetY = toFiniteOr(target?.yPosition, 0);

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;

  if (deltaX === 0 && deltaY === 0) {
    return 0;
  }

  const radians = Math.atan2(deltaX, -deltaY);
  return (radians * (180 / Math.PI) + 360) % 360;
};

export const normalizeDegrees = (value) => ((toFiniteOr(value, 0) % 360) + 360) % 360;

export const normalizeOffsetDegrees = (value) => {
  const normalized = ((toFiniteOr(value, 0) + 540) % 360) - 180;
  return Number.isFinite(normalized) ? normalized : 0;
};

export const radiansToDegrees = (value) => toFiniteOr(value, 0) * (180 / Math.PI);

export const extractTargetId = (link) => {
  if (!link) {
    return '';
  }

  if (typeof link === 'string') {
    return link;
  }

  if (typeof link === 'object') {
    if (link.target !== undefined) {
      return extractTargetId(link.target);
    }

    if (link._id) {
      return link._id.toString();
    }
  }

  return link?.toString?.() ?? '';
};
