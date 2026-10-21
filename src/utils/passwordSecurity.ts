/**
 * Modul Validasi dan Keamanan Kredensial Akun (Username & Kata Sandi)
 * Memenuhi 7 standar keamanan kata sandi dan perlindungan anti-bot.
 */

export interface PasswordRuleCheck {
  id: string;
  label: string;
  isValid: boolean;
  hint: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 - 100
  strengthLabel: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  strengthColor: string;
  rules: PasswordRuleCheck[];
  errors: string[];
}

export interface UsernameValidationResult {
  isValid: boolean;
  rules: {
    length: boolean;
    characters: boolean;
    notReserved: boolean;
  };
  error?: string;
}

// Daftar kata umum / mudah ditebak yang dilarang digunakan dalam sandi
const COMMON_WEAK_WORDS = [
  'password',
  'pass123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'admin',
  'administrator',
  'robotik',
  'robotics',
  'man2kotabekasi',
  'bekasi',
  'rahasia',
  'secret',
  'bismillah',
  'indonesia',
  'default',
  'testing',
  'user123',
  'login123',
];

// Kata-kata yang tidak boleh dipakai sebagai username
const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'superuser',
  'bot',
  'null',
  'undefined',
  'demo_tamu',
  'api',
  'auth',
  'support',
  'guest',
];

/**
 * Validasi Aturan Username:
 * 1. Panjang 4 - 20 karakter
 * 2. Hanya huruf (a-z, A-Z), angka (0-9), titik (.), dan garis bawah (_)
 * 3. Tidak menggunakan kata terlarang sistem (reserved words), kecuali akun sendiri yang sah
 */
export function validateUsername(username: string, currentUsername?: string): UsernameValidationResult {
  const clean = (username || '').trim().toLowerCase();
  const currentClean = (currentUsername || '').trim().toLowerCase();

  const isLengthValid = clean.length >= 4 && clean.length <= 20;
  const isCharsValid = /^[a-zA-Z0-9_.]+$/.test(clean);
  const isNotReserved = (currentClean && clean === currentClean) || !RESERVED_USERNAMES.includes(clean);

  let error: string | undefined;
  if (!clean) {
    error = 'Username is required.';
  } else if (!isLengthValid) {
    error = 'Username must be between 4 and 20 characters.';
  } else if (!isCharsValid) {
    error = 'Username can only contain letters, numbers, dots (.), or underscores (_). No spaces.';
  } else if (!isNotReserved) {
    error = `Username "${clean}" is a reserved system keyword. Please choose another username.`;
  }

  return {
    isValid: isLengthValid && isCharsValid && isNotReserved,
    rules: {
      length: isLengthValid,
      characters: isCharsValid,
      notReserved: isNotReserved,
    },
    error,
  };
}

/**
 * Password validation adhering to 7 security rules
 */
export function validatePassword(
  password: string,
  userContext?: { username?: string; name?: string; email?: string }
): PasswordValidationResult {
  const pwd = password || '';
  const errors: string[] = [];

  // Rule 3: Minimum 12 characters
  const isLengthValid = pwd.length >= 12;
  if (!isLengthValid) {
    errors.push('Password must be at least 12 characters.');
  }

  // Rule 1: Character diversity
  const hasUpperCase = /[A-Z]/.test(pwd);
  const hasLowerCase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd);
  const hasMixedChars = hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

  if (!hasUpperCase) errors.push('Must contain at least 1 uppercase letter (A-Z).');
  if (!hasLowerCase) errors.push('Must contain at least 1 lowercase letter (a-z).');
  if (!hasNumber) errors.push('Must contain at least 1 number (0-9).');
  if (!hasSymbol) errors.push('Must contain at least 1 special symbol (!@#$%^&* etc.).');

  // Rule 2: Avoid common words or personal info
  const lowerPwd = pwd.toLowerCase();
  let containsCommonWord = false;
  for (const word of COMMON_WEAK_WORDS) {
    if (lowerPwd.includes(word)) {
      containsCommonWord = true;
      errors.push(`Contains words that are too common or predictable ("${word}").`);
      break;
    }
  }

  let containsPersonalInfo = false;
  if (userContext?.username && userContext.username.length >= 3) {
    const userPart = userContext.username.toLowerCase().trim();
    if (lowerPwd.includes(userPart)) {
      containsPersonalInfo = true;
      errors.push('Password cannot contain your username.');
    }
  }

  if (userContext?.name && userContext.name.length >= 3) {
    const nameParts = userContext.name.toLowerCase().trim().split(/\s+/);
    for (const part of nameParts) {
      if (part.length >= 3 && lowerPwd.includes(part)) {
        containsPersonalInfo = true;
        errors.push('Password cannot contain your personal name.');
        break;
      }
    }
  }

  // Check repeating character sequences (e.g. 1111, aaaa)
  const hasRepeatedChars = /(.)\1{3,}/.test(pwd);
  if (hasRepeatedChars) {
    errors.push('Avoid repeating the same character sequentially (e.g. "aaaa", "1111").');
  }

  const isFreeFromCommonPatterns = !containsCommonWord && !containsPersonalInfo && !hasRepeatedChars;

  // Evaluate Rule Checks for UI
  const rules: PasswordRuleCheck[] = [
    {
      id: 'length',
      label: 'At least 12 characters',
      isValid: isLengthValid,
      hint: 'Longer passwords are more resilient to brute-force attacks.',
    },
    {
      id: 'uppercase',
      label: 'Uppercase letter (A - Z)',
      isValid: hasUpperCase,
      hint: 'At least one uppercase character.',
    },
    {
      id: 'lowercase',
      label: 'Lowercase letter (a - z)',
      isValid: hasLowerCase,
      hint: 'At least one lowercase character.',
    },
    {
      id: 'number',
      label: 'Number (0 - 9)',
      isValid: hasNumber,
      hint: 'Helps prevent dictionary-based password attacks.',
    },
    {
      id: 'symbol',
      label: 'Special symbol (!@#$%^&* etc.)',
      isValid: hasSymbol,
      hint: 'Adds higher mathematical entropy to the password.',
    },
    {
      id: 'unique_non_common',
      label: 'No common words / personal info',
      isValid: isFreeFromCommonPatterns,
      hint: 'Avoid names, birth dates, or common words like "password", "123456".',
    },
  ];

  // Calculate Strength Score
  let score = 0;
  if (pwd.length >= 8) score += 10;
  if (pwd.length >= 12) score += 20;
  if (pwd.length >= 16) score += 10;
  if (hasUpperCase) score += 15;
  if (hasLowerCase) score += 15;
  if (hasNumber) score += 15;
  if (hasSymbol) score += 15;
  if (isFreeFromCommonPatterns && pwd.length >= 8) score += 15;
  if (hasRepeatedChars || containsCommonWord || containsPersonalInfo) score = Math.max(10, score - 30);

  score = Math.min(100, Math.max(0, score));

  let strengthLabel: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong' = 'Very Weak';
  let strengthColor = 'bg-rose-500 text-rose-700 border-rose-200';

  if (score >= 90 && isLengthValid && hasMixedChars && isFreeFromCommonPatterns) {
    strengthLabel = 'Very Strong';
    strengthColor = 'bg-emerald-500 text-emerald-700 border-emerald-200';
  } else if (score >= 70 && isLengthValid) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-teal-500 text-teal-700 border-teal-200';
  } else if (score >= 50) {
    strengthLabel = 'Medium';
    strengthColor = 'bg-amber-500 text-amber-700 border-amber-200';
  } else if (score >= 30) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-orange-500 text-orange-700 border-orange-200';
  } else {
    strengthLabel = 'Very Weak';
    strengthColor = 'bg-rose-500 text-rose-700 border-rose-200';
  }

  const isValid = isLengthValid && hasMixedChars && isFreeFromCommonPatterns;

  return {
    isValid,
    score,
    strengthLabel,
    strengthColor,
    rules,
    errors,
  };
}

/**
 * Generator Kata Sandi Acak Kuat (16 Karakter Memenuhi Semua Aturan)
 * Memudahkan pengguna membuat password berkualitas tinggi secara otomatis.
 */
export function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Tanpa I, O ambigu
  const lower = 'abcdefghijkmnpqrstuvwxyz'; // Tanpa l, o ambigu
  const numbers = '23456789'; // Tanpa 0, 1 ambigu
  const symbols = '!@#$%^&*()_+-=~';

  const all = upper + lower + numbers + symbols;

  // Pastikan masing-masing set minimal memiliki 2 karakter
  const cryptoObj = window.crypto || (window as any).msCrypto;
  const getRandomByte = () => {
    const arr = new Uint8Array(1);
    cryptoObj.getRandomValues(arr);
    return arr[0];
  };

  const getRandomChar = (charset: string) => charset[getRandomByte() % charset.length];

  const guaranteed = [
    getRandomChar(upper),
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(numbers),
    getRandomChar(symbols),
    getRandomChar(symbols),
  ];

  const remainingLength = 16 - guaranteed.length;
  for (let i = 0; i < remainingLength; i++) {
    guaranteed.push(getRandomChar(all));
  }

  // Acak urutan (Fisher-Yates Shuffle)
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = getRandomByte() % (i + 1);
    const temp = guaranteed[i];
    guaranteed[i] = guaranteed[j];
    guaranteed[j] = temp;
  }

  return guaranteed.join('');
}

/**
 * Generator Soal Verifikasi Manusia (Anti-Bot Challenge)
 */
export interface BotChallenge {
  id: string;
  question: string;
  answer: number;
}

export function generateAntiBotChallenge(): BotChallenge {
  const num1 = Math.floor(Math.random() * 12) + 3; // 3 - 14
  const num2 = Math.floor(Math.random() * 9) + 2;  // 2 - 10
  const isAddition = Math.random() > 0.3; // 70% tambah, 30% kurang

  if (isAddition) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      question: `What is ${num1} + ${num2}?`,
      answer: num1 + num2,
    };
  } else {
    const higher = Math.max(num1, num2) + 5;
    const lower = Math.min(num1, num2);
    return {
      id: Math.random().toString(36).substring(2, 9),
      question: `What is ${higher} - ${lower}?`,
      answer: higher - lower,
    };
  }
}
