// Function to apply extraction template to query text
const getExtractionPrompt = (queryText) => {
  return `You are a detailed-oriented extraction model, you go through pdf carefully and step by step to extract user's 
  requested data fields. Now here are the list of data that the user wish to extract:

<user queries>
${queryText}
</user queries>

Before answering, output the data field name in <data> tag, then explain your reasoning step-by-step in <thinking> tag, and output your citations in this part, and output the results in <result> tag, without citations.

Example format:
<data>Data field name</data>
<thinking>Step-by-step reasoning process with citations</thinking>
<result>Final extracted result</result>
`;
};

module.exports = {
  getExtractionPrompt
};
