// Cargo registration error codes and messages
export interface CargoError {
  code: string;
  title: string;
  description: string;
}

export function parseCargoError(error: unknown): CargoError {
  if (!error || typeof error !== 'object') {
    return {
      code: 'UNKNOWN',
      title: 'Алдаа',
      description: 'Тодорхойгүй алдаа гарлаа',
    };
  }

  const err = error as { code?: string; message?: string; details?: string };

  // PostgreSQL error codes
  switch (err.code) {
    case '23505': // unique_violation
      if (err.details?.includes('track_number')) {
        return {
          code: 'DUPLICATE_TRACK',
          title: 'Давхардсан трак дугаар',
          description: 'Энэ трак дугаар аль хэдийн бүртгэгдсэн байна',
        };
      }
      return {
        code: 'DUPLICATE',
        title: 'Давхардсан мэдээлэл',
        description: err.details || 'Өгөгдөл давхардаж байна',
      };

    case '23503': // foreign_key_violation
      return {
        code: 'FK_VIOLATION',
        title: 'Холбоотой мэдээлэл олдсонгүй',
        description: 'Холбогдох мэдээлэл системд алга байна',
      };

    case '23502': // not_null_violation
      return {
        code: 'REQUIRED_FIELD',
        title: 'Заавал бөглөх талбар',
        description: 'Шаардлагатай талбаруудыг бөглөнө үү',
      };

    case '42501': // insufficient_privilege
    case 'PGRST301': // Row Level Security violation
      return {
        code: 'PERMISSION_DENIED',
        title: 'Эрх хүрэлцэхгүй',
        description: 'Таны эрх энэ үйлдлийг хийхэд хүрэлцэхгүй байна',
      };

    case 'PGRST116': // No rows found
      return {
        code: 'NOT_FOUND',
        title: 'Олдсонгүй',
        description: 'Хайсан мэдээлэл олдсонгүй',
      };

    case '22P02': // invalid_text_representation (e.g., invalid UUID)
      return {
        code: 'INVALID_FORMAT',
        title: 'Буруу формат',
        description: 'Оруулсан мэдээллийн формат буруу байна',
      };

    case '22001': // string_data_right_truncation
      return {
        code: 'TOO_LONG',
        title: 'Хэт урт',
        description: 'Оруулсан текст хэт урт байна',
      };

    case 'P0001': // raise_exception (custom validation error)
      return {
        code: 'VALIDATION_ERROR',
        title: 'Баталгаажуулалтын алдаа',
        description: err.message || 'Мэдээлэл шаардлага хангахгүй байна',
      };

    default:
      // Check for network errors
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        return {
          code: 'NETWORK_ERROR',
          title: 'Сүлжээний алдаа',
          description: 'Интернэт холболтоо шалгана уу',
        };
      }

      // Check for RLS errors in message
      if (err.message?.includes('row-level security') || err.message?.includes('RLS')) {
        return {
          code: 'PERMISSION_DENIED',
          title: 'Эрх хүрэлцэхгүй',
          description: 'Таны эрх энэ үйлдлийг хийхэд хүрэлцэхгүй байна',
        };
      }

      console.error('Unhandled cargo error:', error);
      return {
        code: 'UNKNOWN',
        title: 'Системийн алдаа',
        description: err.message || 'Түр хүлээгээд дахин оролдоно уу',
      };
  }
}

export function logCargoOperation(
  operation: string,
  payload: Record<string, unknown>,
  role: string | null,
  result: { success: boolean; error?: unknown }
) {
  if (process.env.NODE_ENV === 'development') {
    console.group(`📦 Cargo ${operation}`);
    console.log('Role:', role);
    console.log('Payload:', payload);
    if (result.success) {
      console.log('✅ Success');
    } else {
      console.log('❌ Error:', result.error);
    }
    console.groupEnd();
  }
}
