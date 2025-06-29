/**
 * Generate a slug from a title
 * @param {string} title - The title to convert to slug
 * @param {string} language - 'en' for English, 'bn' for Bangla
 * @returns {string} - The generated slug
 */
export const generateSlug = (title, language = 'en') => {
  if (!title || typeof title !== 'string') {
    return '';
  }

  let slug = title.trim();

  if (language === 'bn') {
    // For Bangla, keep the original characters but replace spaces with hyphens
    // and remove any special characters except Bangla letters, numbers, and hyphens
    slug = slug
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\u0980-\u09FFa-z0-9-]/g, '') // Keep only Bangla letters, English letters, numbers, and hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  } else {
    // For English, convert to lowercase and replace spaces with hyphens
    slug = slug
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Keep only letters, numbers, and hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  return slug;
};

/**
 * Generate unique slug by appending a number if the slug already exists
 * @param {string} baseSlug - The base slug
 * @param {Function} checkExists - Function to check if slug exists
 * @returns {Promise<string>} - The unique slug
 */
export const generateUniqueSlug = async (baseSlug, checkExists) => {
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}; 