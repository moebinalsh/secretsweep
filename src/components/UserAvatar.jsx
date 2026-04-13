import { useState } from 'react';
import { User } from 'lucide-react';

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-xs', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', text: 'text-sm', icon: 'w-5 h-5' },
  lg: { container: 'w-20 h-20', text: 'text-2xl', icon: 'w-8 h-8' },
};

function getInitials(user) {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (user.login) return user.login[0].toUpperCase();
  return null;
}

export default function UserAvatar({ user, size = 'sm', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const s = sizeMap[size] || sizeMap.sm;

  const avatarUrl = user?.avatar_url;
  const initials = user ? getInitials(user) : null;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user.login || 'User'}
        onError={() => setImgError(true)}
        className={`${s.container} rounded-full ring-2 ring-gray-200 dark:ring-gray-700 object-cover ${className}`}
      />
    );
  }

  // Fallback: initials or icon
  return (
    <div
      className={`${s.container} rounded-full ring-2 ring-gray-200 dark:ring-gray-700 bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center ${className}`}
    >
      {initials ? (
        <span className={`${s.text} font-bold text-white leading-none`}>{initials}</span>
      ) : (
        <User className={`${s.icon} text-white`} />
      )}
    </div>
  );
}
