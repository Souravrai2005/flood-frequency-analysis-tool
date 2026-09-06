clc
clear

%% 1. Add SFE-IFC toolbox
addpath(genpath('C:\Users\soura\SFE_IFC-Toolbox-main\SFE_IFC-Toolbox-main'))

%% 2. Read discharge data

filename = 'Ukai(1975-2021).xlsx';

sheet_list = sheetnames(filename);
sheet_name = sheet_list{1};

data = readmatrix(filename, 'Sheet', sheet_name);

flowdata = data;

%% 3. Catchment area

area_km = str2double(sheet_name);

%% 4. Independence interval
% SFE-IFC formula: floor(5 + log(A / 1.609^2))
% For A = 62255 km^2 this equals 15 days
interval = floor(5 + log(area_km/1.609^2));

fprintf('Independence interval = %d days\n', interval);

%% 5. Automatic POT threshold selection
[output_para, figuredata] = Auto_select_thre(flowdata, interval);

fprintf('\n--------------------------------------------\n');
fprintf('Automatic POT Threshold Selection Results\n');
fprintf('--------------------------------------------\n');

fprintf('Selected Threshold = %.6f m^3/s\n', output_para(1));
fprintf('AD Statistic       = %.6f\n', output_para(2));
fprintf('Peaks Per Year     = %.6f\n', output_para(3));
fprintf('AD p-value         = %.6f\n', output_para(4));

threshold = output_para(1);

fprintf('\nFINAL SELECTED THRESHOLD = %.6f m^3/s\n', threshold);

%exceedances
exceedances = flowdata(flowdata(:,4) > threshold, :);

fprintf('Number of exceedances = %d\n', size(exceedances,1));

disp('All observations above threshold:');
disp(exceedances);

%% 6. Check percentile only for reference
Q = flowdata(:,4);

P90 = prctile(Q,90);

fprintf('90th percentile discharge = %.4f m^3/s\n', P90);

%% 7. Extract independent POT peaks
% =========================================================
% Two-condition independence criteria:
%
% 1. Time separation > independence interval
% 2. Intermediate minimum discharge <
%       0.75 * minimum of the two peak discharges
%
% If two peaks do not satisfy both conditions, they are
% treated as belonging to the same flood event and the
% larger peak is retained.
% =========================================================

Q = flowdata(:,4);
dates = datenum(flowdata(:,1:3));

% ---------------------------------------------------------
% Step 1: Find all observations above threshold
% ---------------------------------------------------------

exceed_idx = find(Q > threshold);

fprintf('\nRaw threshold exceedances = %d\n', ...
    length(exceed_idx));


% ---------------------------------------------------------
% Step 2: Identify candidate local peaks above threshold
% ---------------------------------------------------------

candidate_idx = [];

for i = 2:length(Q)-1

    if Q(i) > threshold && ...
       Q(i) >= Q(i-1) && ...
       Q(i) >= Q(i+1)

        candidate_idx = [candidate_idx; i];

    end

end

fprintf('Candidate peaks above threshold = %d\n', ...
    length(candidate_idx));


% ---------------------------------------------------------
% Step 3: Apply the two independence conditions
% ---------------------------------------------------------

independent_idx = [];

if ~isempty(candidate_idx)

    % First candidate
    independent_idx = candidate_idx(1);

end


for j = 2:length(candidate_idx)

    idx1 = independent_idx(end);
    idx2 = candidate_idx(j);

    % -----------------------------------------------------
    % Condition 1: Time separation
    % -----------------------------------------------------

    time_difference = dates(idx2) - dates(idx1);

    condition1 = time_difference > interval;


    % -----------------------------------------------------
    % Condition 2: Intermediate minimum discharge
    % -----------------------------------------------------

    if idx2 > idx1 + 1

        Qmin = min(Q(idx1+1:idx2-1));

    else

        Qmin = min(Q(idx1),Q(idx2));

    end

    condition2 = Qmin < ...
                 0.75 * min(Q(idx1),Q(idx2));


    % -----------------------------------------------------
    % Both conditions satisfied
    % -----------------------------------------------------

    if condition1 && condition2

        % Independent flood event
        independent_idx = [independent_idx; idx2];


    else

        % -------------------------------------------------
        % Same flood event:
        % retain the larger peak
        % -------------------------------------------------

        if Q(idx2) > Q(idx1)

            independent_idx(end) = idx2;

        end

    end

end


% ---------------------------------------------------------
% Step 4: Extract final independent POT peaks
% ---------------------------------------------------------

POT_idx = independent_idx;

POT_peaks = Q(POT_idx);

POT_peak_dates = flowdata(POT_idx,1:3);


fprintf('\nNumber of independent POT events = %d\n', ...
    length(POT_peaks));


%% 8. Display independent POT peaks

disp('Independent POT peaks:')

for i = 1:length(POT_peaks)

    fprintf('%3d   %02d-%02d-%04d   %.2f m3/s\n', ...
        i, ...
        POT_peak_dates(i,3), ...
        POT_peak_dates(i,2), ...
        POT_peak_dates(i,1), ...
        POT_peaks(i));

end


%% 9. Create final POT dataset

POT_dataset = [POT_peak_dates, POT_peaks];


%% 10. Save POT dataset

writematrix(POT_dataset, ...
    'C:\RapidsProjects\Btp\data\processed\POT_independent_peaks.xlsx');

fprintf('\nPOT dataset saved successfully.\n');
fprintf('Path: C:\\RapidsProjects\\Btp\\data\\processed\\POT_independent_peaks.xlsx\n');
