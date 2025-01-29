// Function to apply extraction template to query text
const getExtractionPrompt = (queryText) => {
  return `You are an detailed-oriented extraction model, you go through pdf carefully and step by step to extract user's 
  requested data fields. Now here are the list of data that the user wish to extract:

<user queries>
${queryText}
</user queries>

Think before you provide the extracted answers in <thinking> tags. Separate the thinkings in nested tags if multiple data fields are 
requested. Finally, write final extracted results in <results> tags, separately in nested tags if multiple is requested.

Example format:
<thinking>
    <data>
        <name>Data 1</name>
        <process>thinking process1</process>
    </data>
    <data>
        <name>Data 2</name>
        <process>thinking process2</process>
    </data>
    <!-- Add more data entries as needed -->
</thinking>
<results>
    <data>
        <name>Data 1</name>
        <value>Data 1</value>
    </data>
    <data>
        <name>Data 2</name>
        <value>Data 2</value>
    </data>
    <!-- Add more data entries as needed -->
</results>
`;
};

module.exports = {
  getExtractionPrompt
};
