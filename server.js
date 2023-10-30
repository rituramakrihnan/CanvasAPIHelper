const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = 3000;

const storage = multer.memoryStorage(); // Use memory storage for file uploads
const upload = multer({ storage: storage });

require('dotenv').config();

app.use(express.static('public', { 'extensions': ['html', 'js'] }));
app.use(express.urlencoded({ extended: true }));




app.post('/submit', upload.single('AssignmentFile'), async (req, res) => {
    const { login, CourseNo, AssignmentID } = req.body;
    const uploadedFile = req.file;
    const canvasAccessToken = process.env.CANVAS_ACCESS_TOKEN;
    const canvasAPIEndpoint = `https://pacific.instructure.com/api/v1/courses/${CourseNo}/assignments/${AssignmentID}/submissions`;

    try{
    // Step 1: Upload the file to Canvas and get the token and content type
    const { upload_url, content_type} = await uploadFileToCanvas(
        canvasAccessToken,
        uploadedFile,
        CourseNo,
        AssignmentID,
        login
    );

    // Create a FormData object to append the file data
    const formData = new FormData();
    formData.append('file', uploadedFile.buffer, {
        filename: uploadedFile.originalname,
        contentType: content_type, // Use the content_type received from Canvas
    });

    // Step 2: Upload the file data to Canvas and get the file ID
    const {uploadFileId} = await uploadFileDataToCanvas(upload_url, formData, canvasAccessToken);

    // Step 3: Submit the file as part of the student's submission
    const submissionResult = await submitFileAsSubmission(
        canvasAccessToken,
        uploadFileId,
        login,
        canvasAPIEndpoint
    );

    console.log('Canvas API Response:', submissionResult.data);
    res.status(200).send('Assignment submission successful');
} catch (error) {
    handleCanvasAPIError(error, res);
}

});

async function uploadFileToCanvas(canvasAccessToken, uploadedFile, CourseNo, AssignmentID, login) {
    const apiUrl = `https://pacific.instructure.com/api/v1/courses/${CourseNo}/assignments/${AssignmentID}/submissions/${login}/files`;
    // Set up the request headers
    const headers1 = {
        'Authorization': `Bearer ${canvasAccessToken}`,
    };

    // Your JSON data for the request body
    const requestData = {
        name: uploadedFile.originalname,
        size: uploadedFile.size,
        content_type: uploadedFile.mimetype,
    };
    // Make the POST request to upload the file as part of the student's submission
    try {
        const response = await axios.post(apiUrl, requestData, {
            headers: headers1,
        });
        // Destructure the response to get the upload URL and params
        const { upload_url, upload_params} = response.data;
        // Return the upload URL and content type to the caller
        return { upload_url, content_type: upload_params.content_type };
    } catch (error) {
        console.error('Error uploading file as part of the submission:', error.message);
        throw error;
    }
}

async function uploadFileDataToCanvas(upload_url, formData, canvasAccessToken) {
    // Make the POST request to upload the file data
    try {
        const uploadResponse = await axios.post(upload_url, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${canvasAccessToken}`,
            },
        });
        console.log('File data uploaded successfully');
        return { uploadFileId: uploadResponse.data.id };
    } catch (error) {
        console.error('Error uploading file data:', error.message);
        throw error;
    }
}

async function submitFileAsSubmission(canvasAccessToken, uploadFileId, login, canvasAPIEndpoint) {
    const headers = {
        'Authorization': `Bearer ${canvasAccessToken}`,
        'Content-Type': 'application/json', // Set the Content-Type to JSON
    };
    // Your JSON data for the request body
    const requestDataSubmit = {
        submission: {
            submission_type: 'online_upload',
            "file_ids": [uploadFileId],
        },
        "user_id": login
    };
    try {
        const response = await axios.post(canvasAPIEndpoint, requestDataSubmit, {
            headers: headers,
        });
        console.log('Assignment submission successful');
        return response;
    } catch (error) {
        console.log('Assignment submission failed');
        throw error;
    }
}

function handleCanvasAPIError(error, res) {
    if (error.response) {
        if (error.response.status === 404) {
            console.error('Canvas API resource not found:', error.message);
        } else {
            console.error('Canvas API Error:', error.message);
        }
        res.status(500).send('Assignment submission failed');
    } else {
        console.error('Error uploading file:', error.message);
        res.status(500).send('Assignment submission failed');
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
