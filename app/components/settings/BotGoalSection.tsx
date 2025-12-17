'use client';

import { useState, useEffect } from 'react';
import { Target, Loader2, CheckCircle } from 'lucide-react';

interface BotGoalSectionProps {
    onSave?: () => void;
}

const GOALS = [
    { id: 'lead_generation', icon: '🎯', title: 'Lead Generation', desc: 'Collect contact details and qualify leads' },
    { id: 'appointment_booking', icon: '📅', title: 'Appointment Booking', desc: 'Schedule appointments and meetings' },
    { id: 'tripping', icon: '🏠', title: 'Tripping', desc: 'Schedule property site visits' },
    { id: 'purchase', icon: '💰', title: 'Purchase', desc: 'Drive direct sales and orders' },
];

export default function BotGoalSection({ onSave }: BotGoalSectionProps) {
    const [selectedGoal, setSelectedGoal] = useState<string>('lead_generation');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setSelectedGoal(data.primaryGoal || 'lead_generation');
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoalChange = async (goalId: string) => {
        setSelectedGoal(goalId);
        setSaving(true);
        setSaved(false);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryGoal: goalId }),
            });

            if (res.ok) {
                setSaved(true);
                onSave?.();
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (error) {
            console.error('Failed to save goal:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-start gap-5">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <Target size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-normal text-gray-900">Bot Goal</h2>
                        <p className="text-gray-500 mt-1 text-base font-light">
                            Loading...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-5">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <Target size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-normal text-gray-900">Bot Goal</h2>
                        <p className="text-gray-500 mt-1 text-base font-light">
                            What is the primary objective of your AI assistant?
                        </p>
                    </div>
                </div>
                {(saving || saved) && (
                    <div className="flex items-center gap-2 text-sm">
                        {saving ? (
                            <>
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                                <span className="text-gray-500">Saving...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={16} className="text-green-500" />
                                <span className="text-green-600">Saved</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GOALS.map((goal) => (
                    <div
                        key={goal.id}
                        onClick={() => handleGoalChange(goal.id)}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-start gap-4 ${selectedGoal === goal.id
                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${selectedGoal === goal.id ? 'bg-emerald-100' : 'bg-gray-100'
                            }`}>
                            {goal.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-semibold text-base ${selectedGoal === goal.id ? 'text-emerald-900' : 'text-gray-900'
                                }`}>
                                {goal.title}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {goal.desc}
                            </p>
                        </div>
                        <div className="shrink-0">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGoal === goal.id ? 'border-emerald-500' : 'border-gray-300'
                                }`}>
                                {selectedGoal === goal.id && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
