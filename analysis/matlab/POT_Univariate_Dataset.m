%% ============================================================
%  POT DATASET EXTRACTION
%  Peaks Over Threshold
%  ============================================================

clear;
clc;

%% 1. Read original discharge data


%% Read first worksheet name automatically

file_name = 'Ukai(1975-2021).xlsx';

sheet_list = sheetnames(file_name);

sheet_name = sheet_list{1};

data = readmatrix(file_name, ...
    'Sheet', sheet_name);

area = str2double(sheet_name);
%% 2. Create Date column

Date = datetime(data(:,1), data(:,2), data(:,3));

%% 3. Create temporary table

temp = table(Date, data(:,4), ...
    'VariableNames', {'Date', 'Discharge'});

%% 4. Define POT threshold

threshold = 4622.9;

%% 5. Extract all exceedances

exceed = temp(temp.Discharge > threshold, :);

%% 6. Sort exceedances chronologically

exceed = sortrows(exceed, 'Date');

%% 7. Minimum separation between independent flood peaks

% Independence interval calculated from catchment area
interval = floor(5 + log(area / 1.609^2));

%% 8. Identify independent POT events

independent = [];

for i = 1:height(exceed)

    % First exceedance is automatically selected
    if isempty(independent)
        independent(end+1) = i;
        continue;
    end

    % Index of previously selected event
    last_idx = independent(end);

    % Number of days since previous selected peak
    gap = days(exceed.Date(i) - exceed.Date(last_idx));

    if gap >= interval

        % New independent flood event
        independent(end+1) = i;

    else

        % Same flood event
        % Retain the larger discharge

        if exceed.Discharge(i) > exceed.Discharge(last_idx)
            independent(end) = i;
        end

    end

end

%% 9. Create final independent POT dataset

POT = exceed(independent, :);

%% 10. Retain only Date and Peak discharge

POT = POT(:, {'Date', 'Discharge'});

POT.Properties.VariableNames = {'Date', 'Peak'};

%% 11. Display results

disp(POT);

fprintf('\nCatchment area = %.2f\n', area);
fprintf('Independence interval = %d days\n', interval);
fprintf('Threshold = %.1f m³/s\n', threshold);
fprintf('Total exceedances = %d\n', height(exceed));
fprintf('Independent POT events = %d\n', height(POT));

%% 12. Verify all selected peaks exceed threshold

fprintf('All selected peaks exceed threshold: %d\n', ...
    all(POT.Peak > threshold));

%% 13. Save processed POT dataset

writetable(POT, ...
    'C:\RapidsProjects\Btp\data\processed\POT_Univariate_Dataset.xlsx');

fprintf('\nPOT dataset saved successfully.\n');
fprintf('Path: C:\\RapidsProjects\\Btp\\data\\processed\\POT_Univariate_Dataset.xlsx\n');