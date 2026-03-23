import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset user's onboarding flag and data
    const userDataList = await base44.entities.UserQuestData.filter({ created_by: user.email });
    
    if (userDataList.length > 0) {
      const userDataId = userDataList[0].id;
      
      // Delete existing user data to force onboarding
      await base44.asServiceRole.entities.UserQuestData.delete(userDataId);
    }

    return Response.json({ 
      success: true, 
      message: 'Onboarding reset successful. Please refresh the app.' 
    });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});