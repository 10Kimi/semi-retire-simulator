import { AssessmentProvider, useAssessment } from '../contexts/AssessmentContext';
import Layout from '../components/Layout';
import DisclaimerStep from '../components/assessment/DisclaimerStep';
import StepBasicInfo from '../components/assessment/StepBasicInfo';
import StepFinancialInfo from '../components/assessment/StepFinancialInfo';
import StepLifeEvents from '../components/assessment/StepLifeEvents';
import StepRiskTolerance from '../components/assessment/StepRiskTolerance';
import AssessmentResultPage from '../components/assessment/AssessmentResultPage';

function AssessmentWizard() {
  const { state } = useAssessment();

  switch (state.currentStep) {
    case 0:
      return <DisclaimerStep />;
    case 1:
      return <StepBasicInfo />;
    case 2:
      return <StepFinancialInfo />;
    case 3:
      return <StepLifeEvents />;
    case 4:
      return <StepRiskTolerance />;
    case 5:
      return <AssessmentResultPage />;
    default:
      return <DisclaimerStep />;
  }
}

export default function AssessmentPage() {
  return (
    <AssessmentProvider>
      <Layout>
        <main className="max-w-7xl mx-auto px-3 py-4 md:px-4 md:py-6">
          <AssessmentWizard />
        </main>
      </Layout>
    </AssessmentProvider>
  );
}
