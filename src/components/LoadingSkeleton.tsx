import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className,
  variant = 'rect',
  width,
  height,
  lines = 1,
}) => {
  const baseClasses = 'animate-pulse bg-muted rounded';
  
  const variantClasses = {
    text: 'h-4',
    rect: 'h-4',
    circle: 'rounded-full',
  };

  const style = {
    width: width || (variant === 'circle' ? height : '100%'),
    height: height || (variant === 'text' ? '1rem' : '4rem'),
  };

  if (lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(baseClasses, variantClasses[variant])}
            style={{
              ...style,
              width: index === lines - 1 ? '75%' : style.width,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  );
};

// Predefined skeleton components for common use cases
export const MapSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('min-h-[600px] bg-muted rounded-lg relative overflow-hidden', className)}>
    <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse" />
    <div className="absolute top-4 left-4 space-y-2">
      <LoadingSkeleton width={200} height={40} />
      <LoadingSkeleton width={150} height={32} />
    </div>
    <div className="absolute bottom-4 right-4">
      <LoadingSkeleton width={250} height={100} />
    </div>
  </div>
);

export const RouteStatsSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-3', className)}>
    <LoadingSkeleton width={120} height={20} />
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="text-center p-2 bg-muted/30 rounded">
          <LoadingSkeleton width={60} height={12} className="mx-auto mb-1" />
          <LoadingSkeleton width={80} height={16} className="mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

export const WaypointListSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-2', className)}>
    <LoadingSkeleton width={80} height={20} />
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
        <LoadingSkeleton width={120} height={16} />
        <LoadingSkeleton width={24} height={24} variant="circle" />
      </div>
    ))}
  </div>
);

export default LoadingSkeleton;