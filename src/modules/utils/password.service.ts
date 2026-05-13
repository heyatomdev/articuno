import * as bcrypt from 'bcrypt';
import {Injectable} from "@nestjs/common";

@Injectable()
export class PasswordService {
    async hashPassword(password: string): Promise<string> {
        const saltRounds = 12;
        return bcrypt.hash(password, saltRounds);
    }

    async comparePassword(
        providedPassword: string,
        storedHash: string,
    ): Promise<boolean> {
        return bcrypt.compare(providedPassword, storedHash);
    }

    validatePasswordStrength(password: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (password.length < 12) {
            errors.push('Password must be at least 12 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain number');
        }
        if (!/[!@#$%^&*]/.test(password)) {
            errors.push('Password must contain special character (!@#$%^&*)');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}
