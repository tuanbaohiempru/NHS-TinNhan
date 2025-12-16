import { Template } from '../types';
import { INITIAL_TEMPLATES } from '../constants';

const STORAGE_KEY = 'insurechat_templates_v1';

export const getTemplates = (): Template[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Return initial data if storage is empty
    return INITIAL_TEMPLATES;
  } catch (error) {
    console.error("Failed to load templates", error);
    return INITIAL_TEMPLATES;
  }
};

export const saveTemplates = (templates: Template[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save templates", error);
  }
};
