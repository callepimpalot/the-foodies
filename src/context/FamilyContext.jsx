import { createContext, useContext, useState, useEffect } from 'react';

const FamilyContext = createContext();

const DEFAULT_FAMILY = {
    name: 'Wulff Jensen',
    livingStyle: 'RURAL', // RURAL, CITY, NORDIC, COASTAL, SUBURBAN
    preferences: {
        cookTime: 30, // minutes
        complexity: 50, // 0-100
    },
    allergies: [],
    members: [
        /* 
         { id: '1', type: 'DAD', name: 'Dad', avatar: 'dad-1' } 
         Types: DAD, MOM, KID, PET
        */
    ]
};

export function FamilyProvider({ children }) {
    const [familyData, setFamilyData] = useState(() => {
        const saved = localStorage.getItem('meal_buddy_family');
        return saved ? JSON.parse(saved) : DEFAULT_FAMILY;
    });

    useEffect(() => {
        localStorage.setItem('meal_buddy_family', JSON.stringify(familyData));
    }, [familyData]);

    const updateFamilyName = (name) => {
        setFamilyData(prev => ({ ...prev, name }));
    };

    const updateLivingStyle = (style) => {
        setFamilyData(prev => ({ ...prev, livingStyle: style }));
    };

    const updatePreferences = (prefs) => {
        setFamilyData(prev => ({
            ...prev,
            preferences: { ...prev.preferences, ...prefs }
        }));
    };

    const toggleAllergy = (allergy) => {
        setFamilyData(prev => {
            const current = prev.allergies;
            const updated = current.includes(allergy)
                ? current.filter(a => a !== allergy)
                : [...current, allergy];
            return { ...prev, allergies: updated };
        });
    };

    const addMember = (member) => {
        const newMember = {
            ...member,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        setFamilyData(prev => ({
            ...prev,
            members: [...prev.members, newMember]
        }));
    };

    const removeMember = (memberId) => {
        setFamilyData(prev => ({
            ...prev,
            members: prev.members.filter(m => m.id !== memberId)
        }));
    };

    // Helper to clear/reset if needed
    const resetFamily = () => {
        setFamilyData(DEFAULT_FAMILY);
    };

    const value = {
        familyData,
        updateFamilyName,
        updateLivingStyle,
        updatePreferences,
        toggleAllergy,
        addMember,
        removeMember,
        resetFamily
    };

    return (
        <FamilyContext.Provider value={value}>
            {children}
        </FamilyContext.Provider>
    );
}

export function useFamily() {
    const context = useContext(FamilyContext);
    if (!context) {
        throw new Error('useFamily must be used within a FamilyProvider');
    }
    return context;
}
