exports.getMenu = async (filters) => {
    // DB find logic
    return [
        { id: 1, name: 'Nasi Goreng', price: 15000, category: 'food' },
        { id: 2, name: 'Es Teh', price: 5000, category: 'drink' }
    ];
};

exports.addMenuItem = async (data) => {
    return { id: 3, ...data };
};
