const supabase = require('../../config/supabase');

exports.getTodaySummary = async (userId = null) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Filter payments by created_at date
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  let builder = supabase
    .from('payments')
    .select(`
        amount_paid, 
        change_amount,
        method,
        amount_due
    `)
    .gte('paid_at', startOfDay) 
    .lte('paid_at', endOfDay)
    .eq('payment_status', 'paid');
    
  if (userId) {
      builder = builder.eq('user_id', userId);
  }

  const { data: payments, error } = await builder;
  if (error) throw new Error(error.message);

  let totalTransactions = 0;
  let totalCash = 0;
  let totalNonCash = 0;

  payments.forEach(p => {
      totalTransactions += 1;
      
      const trueOmzet = Number(p.amount_due); 

      if (p.method === 'cash') {
          totalCash += trueOmzet;
      } else {
          totalNonCash += trueOmzet;
      }
  });

  return {
    date: today,
    total_transactions: totalTransactions,
    total_cash: totalCash,
    total_non_cash: totalNonCash,
    total_omzet: totalCash + totalNonCash
  };
};
