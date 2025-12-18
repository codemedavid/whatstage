'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, Settings, ExternalLink } from 'lucide-react';

interface ConnectPageStepProps {
    onNext: (data: Record<string, string | undefined>) => void;
    isLoading: boolean;
    initialData?: Record<string, string | undefined>;
}

export default function ConnectPageStep({ onNext, isLoading }: ConnectPageStepProps) {
    const router = useRouter();

    const handleGoToSettings = () => {
        // Complete the wizard first, then redirect to settings
        onNext({});
        // Small delay to ensure wizard completion is processed
        setTimeout(() => {
            router.push('/settings');
        }, 500);
    };

    const handleFinish = () => {
        onNext({});
    };

    return (
        <div className="flex flex-col h-full justify-between text-center">
            <div className="space-y-8 flex flex-col items-center justify-center flex-1">

                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle className="w-10 h-10" />
                </div>

                <div>
                    <h3 className="text-2xl font-extrabold text-[#112D29]">All Set!</h3>
                    <p className="text-gray-500 mt-2 max-w-xs mx-auto">
                        Your AI assistant is configured and ready. Connect your Facebook page to start receiving messages.
                    </p>
                </div>

                <div className="w-full max-w-sm space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Settings size={20} className="text-blue-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-gray-900 text-sm">Connect Facebook Page</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    You can connect your Facebook page from the Settings page at any time.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        className="w-full py-3 bg-[#1877F2] text-white rounded-xl font-bold hover:bg-[#166fe5] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 group"
                        onClick={handleGoToSettings}
                    >
                        <span className="bg-white/20 p-1 rounded group-hover:bg-white/30 transition-colors">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </span>
                        Connect Facebook Page
                        <ExternalLink size={16} className="opacity-70" />
                    </button>
                    <p className="text-xs text-gray-400">
                        Opens Settings page to connect your page.
                    </p>
                </div>
            </div>

            <div className="pt-6">
                <button
                    onClick={handleFinish}
                    disabled={isLoading}
                    className="w-full py-4 border-2 border-gray-100 text-gray-600 bg-white hover:border-gray-300 hover:text-gray-800 rounded-xl font-bold transition-all duration-200"
                >
                    {isLoading ? 'Finishing...' : 'Skip for now'}
                </button>
            </div>
        </div>
    );
}
