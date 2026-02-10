const emojiImage = (emoji) => `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231a1b1e'/%3E%3Ctext y='.9em' x='5' font-size='80'%3E${encodeURIComponent(emoji)}%3C/text%3E%3C/svg%3E`;

export const RECIPES = [
    {
        id: 1,
        title: 'High-Protein Chicken & Broccoli',
        archetypes: ['TRAINING', 'MINIMALIST'],
        ingredients: ['Chicken Breast', 'Broccoli', 'Rice'],
        time: '20m',
        baseServings: 2,
        image: '/images/recipes/chicken_broccoli.png',
        description: 'Lean protein and clean carbs for sustained energy.'
    },
    {
        id: 2,
        title: 'Family Pasta Night',
        archetypes: ['FAMILY'],
        ingredients: ['Pasta', 'Tomato Sauce', 'Cheese'],
        time: '30m',
        baseServings: 2,
        image: '/images/recipes/pasta_night.png',
        description: 'Crowd-pleaser that scales easily for the whole team.'
    },
    {
        id: 3,
        title: 'Thai Green Curry',
        archetypes: ['STUDENT', 'FOODIE'],
        ingredients: ['Chicken Breast', 'Coconut Milk', 'Curry Paste', 'Bamboo Shoots'],
        time: '45m',
        baseServings: 2,
        image: '/images/recipes/thai_curry.png',
        description: 'A vibrant balance of aromatic Thai flavors and textures.'
    },
    {
        id: 4,
        title: 'Veggie Stir-Fry',
        archetypes: ['MINIMALIST', 'STUDENT'],
        ingredients: ['Broccoli', 'Carrots', 'Rice', 'Soy Sauce'],
        time: '15m',
        baseServings: 2,
        image: '/images/recipes/veggie_stir_fry.png',
        description: 'Quick, zero-waste kitchen staple using fresh seasonal produce.'
    },
    {
        id: 5,
        title: 'Post-Workout Omelet',
        archetypes: ['TRAINING'],
        ingredients: ['Eggs', 'Spinach', 'Cheese'],
        time: '10m',
        baseServings: 2,
        image: '/images/recipes/post_workout_omelet.png',
        description: 'Nutrient-dense recovery fuel for active lifestyles.'
    },
    {
        id: 6,
        title: 'Overnight Oats',
        archetypes: ['MINIMALIST', 'STUDENT'],
        ingredients: ['Oats', 'Milk', 'Peanut Butter', 'Banana'],
        time: '5m',
        baseServings: 2,
        image: '/images/recipes/overnight_oats.png',
        description: 'Prepare once, eat all week. The ultimate time-saver.'
    },
    {
        id: 7,
        title: 'Budget Beef Burritos',
        archetypes: ['FAMILY', 'STUDENT'],
        ingredients: ['Ground Beef', 'Tortillas', 'Beans', 'Rice', 'Cheese'],
        time: '25m',
        baseServings: 2,
        image: '/images/recipes/beef_burritos.png',
        description: 'Hearty, affordable, and packed with traditional flavors.'
    },
    {
        id: 8,
        title: 'Salmon & Asparagus',
        archetypes: ['TRAINING', 'FOODIE'],
        ingredients: ['Salmon', 'Asparagus', 'Lemon', 'Olive Oil'],
        time: '20m',
        baseServings: 2,
        image: '/images/recipes/salmon_asparagus.png',
        description: 'Elegant, nutrient-rich dinner that pairs with anything.'
    },
    {
        id: 9,
        title: 'Classic Margherita Pizza',
        archetypes: ['FAMILY', 'FOODIE'],
        ingredients: ['Pizza Dough', 'Tomato Sauce', 'Mozzarella', 'Basil'],
        time: '15m',
        baseServings: 2,
        image: '/images/recipes/margherita_pizza.png',
        description: 'Thin-crust artisan pizza with simple, fresh ingredients.'
    },
    {
        id: 10,
        title: 'Quinoa Salad Bowl',
        archetypes: ['TRAINING', 'MINIMALIST'],
        ingredients: ['Quinoa', 'Cucumber', 'Chickpeas', 'Lemon'],
        time: '15m',
        baseServings: 2,
        image: '/images/recipes/quinoa_salad.png',
        description: 'Refreshing Mediterranean-inspired plant-based power bowl.'
    },
    {
        id: 11,
        title: 'Sheet Pan Sausage & Peppers',
        archetypes: ['MINIMALIST', 'FAMILY'],
        ingredients: ['Sausage', 'Bell Peppers', 'Onion', 'Olive Oil'],
        time: '35m',
        baseServings: 2,
        image: emojiImage('🌭'),
        description: 'Minimal cleanup, maximum efficiency for busy nights.'
    },
    {
        id: 12,
        title: 'Lentil Soup',
        archetypes: ['STUDENT', 'MINIMALIST'],
        ingredients: ['Lentils', 'Carrots', 'Onion', 'Spinach'],
        time: '40m',
        baseServings: 2,
        image: emojiImage('🍲'),
        description: 'Cozy, shelf-stable nutrition for cold evenings.'
    },
    {
        id: 13,
        title: 'Avocado Toast with Egg',
        archetypes: ['STUDENT', 'FOODIE'],
        ingredients: ['Bread', 'Avocado', 'Eggs'],
        time: '10m',
        baseServings: 2,
        image: emojiImage('🥑'),
        description: 'A modern staple, balanced for texture and taste.'
    },
    {
        id: 14,
        title: 'Tuna Salad Sandwich',
        archetypes: ['MINIMALIST', 'STUDENT'],
        ingredients: ['Canned Tuna', 'Bread', 'Mayo', 'Cucumber'],
        time: '5m',
        baseServings: 2,
        image: emojiImage('🥪'),
        description: 'Quick express protein for on-the-go lifestyles.'
    },
    {
        id: 15,
        title: 'Steak & Sweet Potato',
        archetypes: ['TRAINING', 'FOODIE'],
        ingredients: ['Steak', 'Sweet Potato', 'Broccoli'],
        time: '25m',
        baseServings: 2,
        image: emojiImage('🥩'),
        description: 'High-performance fuel for strength and recovery.'
    },
    {
        id: 16,
        title: 'Street Tacos',
        archetypes: ['FAMILY', 'STUDENT'],
        ingredients: ['Beef', 'Tortillas', 'Onion', 'Cilantro'],
        time: '20m',
        baseServings: 2,
        image: emojiImage('🌮'),
        description: 'Bold street-style flavors in under 20 minutes.'
    },
    {
        id: 17,
        title: 'Classic Cheeseburger',
        archetypes: ['FAMILY', 'STUDENT'],
        ingredients: ['Ground Beef', 'Buns', 'Cheese', 'Lettuce'],
        time: '15m',
        baseServings: 2,
        image: emojiImage('🍔'),
        description: 'The definitive comfort classic, built for satisfaction.'
    },
    {
        id: 18,
        title: 'Greek Salad',
        archetypes: ['MINIMALIST', 'TRAINING'],
        ingredients: ['Cucumber', 'Tomatoes', 'Feta Cheese', 'Olives'],
        time: '10m',
        baseServings: 2,
        image: emojiImage('🥗'),
        description: 'Hydrating, fresh, and perfectly balanced nutrition.'
    }
];
