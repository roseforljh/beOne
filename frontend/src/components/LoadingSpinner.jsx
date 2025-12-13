import TaijiLogo from './TaijiLogo';

export default function LoadingSpinner({ message = '加载中...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <TaijiLogo size={100} animate={true} />
      <p className="mt-4 text-taiji-gray-500">{message}</p>
    </div>
  );
}

