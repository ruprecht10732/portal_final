import { HttpContextToken } from '@angular/common/http';

export const SKIP_GLOBAL_ERROR_REPORTING = new HttpContextToken<boolean>(() => false);